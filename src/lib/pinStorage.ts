// In-memory PIN storage
// TODO: Replace with database when ready
interface PINRecord {
  email: string;
  pin: string;
  createdAt: Date;
  expiresAt: Date;
  used: boolean;
}

const pinRecords = new Map<string, PINRecord>();

export function generatePIN(): string {
  return Math.random().toString().slice(2, 8);
}

export function storePIN(email: string, pin: string): void {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 15); // PIN expires in 15 minutes

  pinRecords.set(email, {
    email,
    pin,
    createdAt: new Date(),
    expiresAt,
    used: false,
  });
}

export function verifyPIN(email: string, pin: string): boolean {
  const record = pinRecords.get(email);

  if (!record) {
    return false;
  }

  // Check if PIN is already used
  if (record.used) {
    return false;
  }

  // Check if PIN is expired
  if (new Date() > record.expiresAt) {
    return false;
  }

  // Check if PIN matches
  if (record.pin !== pin) {
    return false;
  }

  // Mark PIN as used
  record.used = true;

  return true;
}

export function getPINRecord(email: string): PINRecord | undefined {
  return pinRecords.get(email);
}
