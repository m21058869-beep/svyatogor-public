import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from './env';

let client: S3Client | null = null;

function getClient(): S3Client {
  const { endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle, publicUrl } = env.s3;
  if (!bucket || !accessKeyId || !secretAccessKey || !publicUrl) {
    throw new Error('S3 не настроено: задайте S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY и S3_PUBLIC_URL');
  }
  if (!client) {
    client = new S3Client({
      endpoint,
      region,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
      // Новые версии SDK по умолчанию шлют CRC-контрольные суммы,
      // которые поддерживают не все S3-совместимые хранилища.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  return client;
}

/** Загружает объект в публичный бакет и возвращает его публичный URL. */
export async function uploadPublicObject(key: string, body: Uint8Array, contentType: string): Promise<string> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  return `${env.s3.publicUrl}/${key}`;
}

/**
 * Ключ объекта внутри НАШЕГО публичного бакета по его публичному URL.
 *
 * Возвращает null, если адрес пуст, не разбирается как URL или ведёт на другой
 * хост/бакет: удалять и перезаписывать чужие объекты нельзя, поэтому такой адрес
 * просто игнорируется (та же проверка, что в /api/download).
 */
export function keyFromPublicUrl(raw: string | null | undefined): string | null {
  if (!raw || !env.s3.publicUrl) return null;

  let base: URL;
  let target: URL;
  try {
    base = new URL(env.s3.publicUrl);
    target = new URL(raw);
  } catch {
    return null;
  }

  const basePath = base.pathname.replace(/\/+$/, '');
  if (target.origin !== base.origin) return null;
  if (target.pathname === basePath) return null;
  if (!target.pathname.startsWith(`${basePath}/`)) return null;

  const rawKey = target.pathname.slice(basePath.length + 1);
  if (rawKey === '') return null;
  try {
    // В URL ключ может быть процентно-кодированным.
    return decodeURIComponent(rawKey);
  } catch {
    return rawKey;
  }
}

/** Удаляет объект из публичного бакета по его ключу. */
export async function deletePublicObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }));
}

/**
 * Удаляет объект по публичному URL. Адреса вне нашего бакета игнорируются
 * (см. keyFromPublicUrl) — вызов безопасен для любых значений из БД.
 */
export async function deletePublicObjectByUrl(raw: string | null | undefined): Promise<void> {
  const key = keyFromPublicUrl(raw);
  if (!key) return;
  await deletePublicObject(key);
}
