const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const LONG_HASH_PATTERN = /(?:^|[_-])[0-9a-f]{20,}(?:[_-]|$)/i;
const MACHINE_IMAGE_PREFIX = /^(?:img|image)[_-]v\d+(?:[_-]|$)/i;

export const getReadableAttachmentLabel = (
  rawName: string | null | undefined,
  index: number,
): string => {
  const fallback = `参考图 ${index + 1}`;
  const name = String(rawName || '').trim();
  if (!name) return fallback;

  const baseName = name.replace(/\.[a-z0-9]{2,5}$/i, '');
  const looksMachineGenerated = UUID_PATTERN.test(baseName)
    || LONG_HASH_PATTERN.test(baseName)
    || MACHINE_IMAGE_PREFIX.test(baseName);

  if (looksMachineGenerated) return fallback;
  return name;
};
