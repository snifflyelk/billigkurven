const BASIC_PREFIX = "Basic ";

function safeDecodeBase64(value: string) {
  try {
    return atob(value);
  } catch {
    return null;
  }
}

export function parseBasicAuthHeader(headerValue: string | null) {
  if (!headerValue || !headerValue.startsWith(BASIC_PREFIX)) {
    return null;
  }

  const encoded = headerValue.slice(BASIC_PREFIX.length).trim();
  const decoded = safeDecodeBase64(encoded);
  if (!decoded) {
    return null;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex <= 0) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

export function isAdminBasicAuthAuthorized(
  headerValue: string | null,
  expectedUser: string | undefined,
  expectedPassword: string | undefined,
) {
  if (!expectedUser || !expectedPassword) {
    return false;
  }

  const parsed = parseBasicAuthHeader(headerValue);
  if (!parsed) {
    return false;
  }

  return parsed.username === expectedUser && parsed.password === expectedPassword;
}
