const net = require('net');
const crypto = require('crypto');

class RouterOSAPI {
  constructor(host, port = 8728) {
    this.host = host;
    this.port = port;
    this.socket = null;
    this.connected = false;
    this.commandId = 0;
    this.callbacks = new Map();
  }

  connect(username, password, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.disconnect();
        reject(new Error('Connection timeout'));
      }, timeout);

      this.socket = new net.Socket();
      
      this.socket.connect(this.port, this.host, async () => {
        try {
          clearTimeout(timeoutId);
          // Mark as connected so initial /login command can be sent
          this.connected = true;
          await this.login(username, password);
          resolve();
        } catch (error) {
          clearTimeout(timeoutId);
          this.connected = false;
          this.disconnect();
          reject(error);
        }
      });

      this.socket.on('error', (error) => {
        clearTimeout(timeoutId);
        this.connected = false;
        this.disconnect();
        reject(error);
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('close', () => {
        this.connected = false;
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this.callbacks.clear();
  }

  async login(username, password) {
    // Try RouterOS v7+ plain login first
    try {
      const plainResp = await this.sendCommand([
        '/login',
        `=name=${username}`,
        `=password=${password}`
      ]);
      // If any !trap present, fall back to challenge
      const trapped = plainResp.some(item => item['!trap'] || item['!fatal']);
      if (!trapped) {
        return; // success
      }
    } catch (_) {
      // fall back to challenge method
    }

    // Legacy challenge-response login (v6)
    const loginResponse = await this.sendCommand(['/login']);

    if (loginResponse.length === 0 || !loginResponse[0]['=ret']) {
      throw new Error('Login failed: No challenge received');
    }

    const challenge = loginResponse[0]['=ret'];

    // Calculate response using MD5
    const md5 = crypto.createHash('md5');
    md5.update(Buffer.concat([
      Buffer.from([0]),
      Buffer.from(password, 'utf8'),
      Buffer.from(challenge, 'hex')
    ]));
    const response = md5.digest('hex');

    // Send credentials
    const authResponse = await this.sendCommand([
      '/login',
      `=name=${username}`,
      `=response=00${response}`
    ]);

    if (authResponse.some(item => item['!trap'] || item['!fatal'])) {
      throw new Error('Login failed: Invalid credentials');
    }
  }

  sendCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      const id = ++this.commandId;
      const tag = `.tag=${id}`;
      
      this.callbacks.set(id, { resolve, reject, responses: [] });

      // Encode and send command
      const encoded = this.encodeCommand([...command, tag]);
      this.socket.write(encoded);

      // Set timeout for command (increase to 20s)
      setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error('Command timeout (20s)'));
        }
      }, 20000);
    });
  }

  encodeCommand(command) {
    const encoded = [];
    
    for (const word of command) {
      const wordBuffer = Buffer.from(word, 'utf8');
      const lengthBuffer = this.encodeLength(wordBuffer.length);
      encoded.push(lengthBuffer, wordBuffer);
    }
    
    // Add empty word to end command
    encoded.push(Buffer.from([0]));
    
    return Buffer.concat(encoded);
  }

  encodeLength(length) {
    if (length < 0x80) {
      return Buffer.from([length]);
    } else if (length < 0x4000) {
      return Buffer.from([0x80 | (length >> 8), length & 0xFF]);
    } else if (length < 0x200000) {
      return Buffer.from([0xC0 | (length >> 16), (length >> 8) & 0xFF, length & 0xFF]);
    } else if (length < 0x10000000) {
      return Buffer.from([0xE0 | (length >> 24), (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF]);
    } else {
      return Buffer.from([0xF0, (length >> 24) & 0xFF, (length >> 16) & 0xFF, (length >> 8) & 0xFF, length & 0xFF]);
    }
  }

  handleData(data) {
    // Simple data handler - in production, you'd want proper sentence parsing
    const responses = this.parseResponses(data);
    
    for (const response of responses) {
      const tag = response['.tag'];
      if (tag && this.callbacks.has(parseInt(tag))) {
        const callback = this.callbacks.get(parseInt(tag));
        
        if (response['!done']) {
          callback.resolve(callback.responses);
          this.callbacks.delete(parseInt(tag));
        } else if (response['!trap'] || response['!fatal']) {
          callback.reject(new Error(response['=message'] || 'Command failed'));
          this.callbacks.delete(parseInt(tag));
        } else {
          callback.responses.push(response);
        }
      }
    }
  }

  parseResponses(data) {
    // Simplified response parser - this is a basic implementation
    // In production, you'd want a more robust parser
    const responses = [];
    let offset = 0;
    
    while (offset < data.length) {
      try {
        const { sentence, newOffset } = this.parseSentence(data, offset);
        if (sentence) {
          responses.push(sentence);
        }
        offset = newOffset;
      } catch (error) {
        break;
      }
    }
    
    return responses;
  }

  parseSentence(data, offset) {
    const sentence = {};
    let currentOffset = offset;
    
    while (currentOffset < data.length) {
      const { length, newOffset } = this.decodeLength(data, currentOffset);
      currentOffset = newOffset;
      
      if (length === 0) {
        // End of sentence
        return { sentence, newOffset: currentOffset };
      }
      
      if (currentOffset + length > data.length) {
        throw new Error('Incomplete sentence');
      }
      
      const word = data.slice(currentOffset, currentOffset + length).toString('utf8');
      currentOffset += length;
      
      // Words can be: !re, !done, !trap, .tag=123, =name=foo, =message=bar
      if (word.startsWith('!')) {
        sentence[word] = true;
      } else if (word.startsWith('.tag=')) {
        // Normalize tag to numeric id only
        const parts = word.split('=');
        sentence['.tag'] = parts[1] || parts[parts.length - 1];
      } else if (word.startsWith('=')) {
        const equalPos = word.indexOf('=', 1);
        if (equalPos > 0) {
          const key = word.substring(1, equalPos);
          const value = word.substring(equalPos + 1);
          sentence[`=${key}`] = value;
        } else {
          sentence[word] = true;
        }
      } else {
        sentence[word] = true;
      }
    }
    
    return { sentence, newOffset: currentOffset };
  }

  decodeLength(data, offset) {
    if (offset >= data.length) {
      throw new Error('No data to decode length');
    }
    
    const firstByte = data[offset];
    
    if (firstByte < 0x80) {
      return { length: firstByte, newOffset: offset + 1 };
    } else if (firstByte < 0xC0) {
      if (offset + 1 >= data.length) throw new Error('Incomplete length');
      return { 
        length: ((firstByte & 0x7F) << 8) | data[offset + 1], 
        newOffset: offset + 2 
      };
    } else if (firstByte < 0xE0) {
      if (offset + 2 >= data.length) throw new Error('Incomplete length');
      return { 
        length: ((firstByte & 0x1F) << 16) | (data[offset + 1] << 8) | data[offset + 2], 
        newOffset: offset + 3 
      };
    } else if (firstByte < 0xF0) {
      if (offset + 3 >= data.length) throw new Error('Incomplete length');
      return { 
        length: ((firstByte & 0x0F) << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3], 
        newOffset: offset + 4 
      };
    } else {
      if (offset + 4 >= data.length) throw new Error('Incomplete length');
      return { 
        length: (data[offset + 1] << 24) | (data[offset + 2] << 16) | (data[offset + 3] << 8) | data[offset + 4], 
        newOffset: offset + 5 
      };
    }
  }

  async getSystemIdentity() {
    try {
      const response = await this.sendCommand(['/system/identity/print']);
      if (response.length > 0 && response[0]['=name']) {
        return response[0]['=name'];
      }
      return null;
    } catch (error) {
      throw new Error(`Failed to get system identity: ${error.message}`);
    }
  }
}

module.exports = { RouterOSAPI };