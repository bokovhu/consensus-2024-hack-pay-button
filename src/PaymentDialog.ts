import { IPaymentIntent } from "./IPaymentIntent";
import { IPaymentRequest } from "./IPaymentRequest";
import { ISourceAddress } from "./ISourceAddress";

export class PaymentDialog {
    constructor(
        private _paymentRequest: IPaymentRequest,
        private _addresses: Array<ISourceAddress>
    ) { }

    async show(): Promise<IPaymentIntent> {
        return await new Promise((resolve, reject) => {
            // Create a new window
            const dialogWindow = window.open("", "Payment", "width=400,height=300");

            if (!dialogWindow) {
                reject("Failed to open dialog window");
                return;
            }

            // Create HTML content for the dialog window
            const htmlContent = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Payment</title>
                </head>
                <body>
                    <p>
                        You are paying <b>${this._paymentRequest.amount / 1_000_000_000_000} SIO</b> to <b>${this._paymentRequest.to}</b>
                    </p>
                    <p>
                        Notes: <i>${this._paymentRequest.notes ?? 'No notes'}</i>
                    </p>
                    <form id="paymentForm">
                        <label for="accountSelect">Select an account to pay from:</label>
                        <select id="accountSelect" name="account">
                            ${this._addresses.map(thing => `<option value="${thing.address}">${thing.name}</option>`).join('')}
                        </select>
                        <button type="submit">Confirm</button>
                    </form>
                    <script>
                        document.getElementById('paymentForm').addEventListener('submit', function(event) {
                            event.preventDefault();
                            const selectedValue = document.getElementById('accountSelect').value;
                            window.opener.postMessage(selectedValue, "*");
                            window.close();
                        });
                    </script>
                </body>
            `;

            dialogWindow.document.write(htmlContent);
            dialogWindow.document.close();

            const pr = this._paymentRequest;

            window.addEventListener('message', function onMessage(event) {
                resolve(
                    {
                        request: pr,
                        address: event.data
                    }
                );
                window.removeEventListener('message', onMessage);
            });
        });
    }
}