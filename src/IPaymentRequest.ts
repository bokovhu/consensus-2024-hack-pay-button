export interface IPaymentRequest {
    to: string;
    amount: number;
    notes?: string | null;
}
