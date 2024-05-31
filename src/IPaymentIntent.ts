import { IPaymentRequest } from "./IPaymentRequest";

export interface IPaymentIntent {
    request: IPaymentRequest;
    address: string;
}