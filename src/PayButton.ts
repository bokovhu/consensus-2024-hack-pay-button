import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';
import { ApiPromise, WsProvider } from '@polkadot/api';

async function selectSenderAddress(
    addresses: Array<{ name: string, address: string }>,
    notes?: string,
    paidAmount?: number
): Promise<string> {
    return await new Promise((resolve, reject) => {
        // Create a new window
        const dialogWindow = window.open("", "SelectDialog", "width=400,height=300");

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
                <title>Select Account</title>
            </head>
            <body>
                <p>
                    ${notes ?? 'Please select an account to use for the payment'}
                </p>
                <p>
                    <i>Paid amount: </i><b>${paidAmount ?? '0'} SIO</b>
                </p>
                <form id="selectForm">
                    <label for="accountSelect">Select an account:</label>
                    <select id="accountSelect" name="account">
                        ${addresses.map(thing => `<option value="${thing.address}">${thing.name}</option>`).join('')}
                    </select>
                    <button type="submit">Confirm</button>
                </form>
                <script>
                    document.getElementById('selectForm').addEventListener('submit', function(event) {
                        event.preventDefault();
                        const selectedValue = document.getElementById('accountSelect').value;
                        window.opener.postMessage(selectedValue, "*");
                        window.close();
                    });
                </script>
            </body>
            </html>
        `;

        // Write the HTML content to the new window's document
        dialogWindow.document.write(htmlContent);
        dialogWindow.document.close();

        // Add an event listener to handle the result from the dialog window
        window.addEventListener('message', function onMessage(event) {
            resolve(event.data);
            window.removeEventListener('message', onMessage);
        });
    });
}

const AMOUNT_MULTIPLIER = 1_000_000_000_000;

export class PayButton extends HTMLElement {
    constructor() {
        super();
        const thisAttrs = this.attributes;
        const thisContent = this.innerHTML;

        const priceAttr = thisAttrs.getNamedItem('price')?.textContent;
        const payToAttr = thisAttrs.getNamedItem('to')?.textContent;
        const noteAttr = thisAttrs.getNamedItem('note')?.textContent;
        const completedAttr = thisAttrs.getNamedItem('completed')?.textContent;
        const rpcUrlAttr = thisAttrs.getNamedItem('rpc-url')?.textContent ?? 'wss://rpc.sionet.siocode.hu';

        const calculatedPrice = parseFloat(priceAttr ?? '0') * AMOUNT_MULTIPLIER;

        this.attachShadow({ mode: 'open' });
        if (this.shadowRoot) {
            this.shadowRoot.innerHTML = `
<button>
    <slot></slot>
</button>
`;
            this.shadowRoot.querySelector('button')?.addEventListener('click', async () => {
                console.log('Pay button clicked');

                const allInjected = await web3Enable('pay-button');
                const allAccounts = await web3Accounts();

                console.log('Injected:', allInjected);
                console.log('Accounts:', allAccounts);

                const senderAccount = await selectSenderAddress(
                    allAccounts.map(
                        ({ address, meta }) => ({ name: meta.name ?? '<<No Name>>', address })
                    ),
                    noteAttr ?? 'Please select an account to use for the payment',
                    priceAttr ? parseFloat(priceAttr) : undefined
                );
                const injector = await web3FromAddress(senderAccount);

                console.log('Selected sender:', senderAccount);

                const paidEvent = {
                    price: priceAttr,
                    payTo: payToAttr,
                    note: noteAttr,
                    status: 'PENDING'
                };

                const completedFn = new Function(
                    "event",
                    completedAttr || "console.log('Payment completed')"
                );
                const wsProvider = new WsProvider(rpcUrlAttr);

                try {
                    await new Promise<void>(
                        async (resolve, reject) => {
                            const api = await ApiPromise.create({ provider: wsProvider });
                            await api.isReady;

                            await api.tx.balances.transferKeepAlive(payToAttr, calculatedPrice).signAndSend(
                                senderAccount,
                                { signer: injector.signer as any },
                                ({ status }) => {
                                    console.log('Transaction status:', status.type);
                                    if (status.isInBlock || status.isFinalized) {
                                        resolve();
                                    } else if (status.isDropped || status.isInvalid || status.isUsurped) {
                                        reject('Transaction failed');
                                    }
                                }
                            );
                        }
                    );
                    paidEvent.status = 'SUCCESS';
                } catch (error) {
                    console.error('Payment error:', error);
                    paidEvent.status = 'ERROR';
                } finally {
                    wsProvider.disconnect();
                }

                completedFn(paidEvent);
            });
        }
    }
}