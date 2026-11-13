import crypto from "crypto";

const BASE_URL = process.env.BICTORYS_API_URL ?? "https://api.test.bictorys.com/pay/v1";
const API_KEY = process.env.BICTORYS_API_KEY ?? "";
const WEBHOOK_SECRET = process.env.BICTORYS_WEBHOOK_SECRET ?? "";

export interface ChargeParams {
  reservationId: string;
  reference: string;
  amountXof: number;
  paymentMethod: "WAVE" | "ORANGE_MONEY";
  customerPhone: string;
  customerName: string;
  returnUrl: string;
}

export interface ChargeResult {
  chargeId: string;
  paymentUrl: string;
  status: "pending";
}

const METHOD_MAP: Record<string, string> = {
  WAVE: "wave_money",
  ORANGE_MONEY: "orange_money",
};

export async function createCharge(params: ChargeParams): Promise<ChargeResult> {
  const body = {
    amount: params.amountXof,
    currency: "XOF",
    payment_method: METHOD_MAP[params.paymentMethod],
    reference: params.reference,
    customer: { phone: params.customerPhone, name: params.customerName },
    return_url: params.returnUrl,
    metadata: { reservationId: params.reservationId },
  };

  const res = await fetch(`${BASE_URL}/charges`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bictorys error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { id: string; payment_url: string };
  return { chargeId: data.id, paymentUrl: data.payment_url, status: "pending" };
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
