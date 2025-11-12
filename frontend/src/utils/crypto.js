// ========== Base64 helpers==========
export function toB64(u8) {
  return btoa(String.fromCharCode(...u8));
}

export function fromB64(b64) {
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

// ========== Генерация AES ключа ==========
export async function generateAesKey() {
  return crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  );
}

// ========== Шифрование блоками ==========
export async function encryptBlocks(bytes, key, blockSize = 64 * 1024) {
  const blocks = [];

  for (let i = 0; i < bytes.length; i += blockSize) {
    const chunk = bytes.slice(i, i + blockSize);

    // IV — nonce. Новый для каждого блока.
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        chunk
      )
    );

    blocks.push({
      iv: toB64(iv),
      ct: toB64(encrypted)
    });
  }

  return blocks;
}

// ========== Расшифровка блоков ==========
export async function decryptBlocks(blocks, key) {
  const parts = [];
  let size = 0;

  for (const { iv, ct } of blocks) {
    const ivU8 = fromB64(iv);
    const ctU8 = fromB64(ct);

    const plain = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivU8 },
        key,
        ctU8
      )
    );

    parts.push(plain);
    size += plain.length;
  }

  const result = new Uint8Array(size);
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

// ========== Экспорт / Импорт ключа==========
export async function exportKey(key) {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return toB64(raw);
}

export async function importKey(b64) {
  const raw = fromB64(b64);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}