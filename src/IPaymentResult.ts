export interface IPaymentResult {
    status: 'PENDING' | 'SUCCESS' | 'ERROR';
    to: string;
    from: string;
    amount: number;
    notes?: string;
}