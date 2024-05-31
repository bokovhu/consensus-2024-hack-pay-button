import { web3Accounts, web3Enable, web3FromAddress } from '@polkadot/extension-dapp';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { PaymentDialog } from './PaymentDialog';


const AMOUNT_MULTIPLIER = 1_000_000_000_000;

export class PayButton extends HTMLElement {
    constructor() {
        super();
        const thisAttrs = this.attributes;

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
                if (this.shadowRoot) {
                    this.shadowRoot.innerHTML = '<button>Processing...</button>';
                }
                const allInjected = await web3Enable('pay-button');
                const allAccounts = await web3Accounts();

                const paymentDialog = new PaymentDialog(
                    {
                        amount: calculatedPrice,
                        to: payToAttr!,
                        notes: noteAttr
                    },
                    allAccounts.map(account => ({
                        name: account.meta.name ?? 'Unknown',
                        address: account.address
                    }))
                );
                const paymentIntent = await paymentDialog.show();
                const injector = await web3FromAddress(
                    paymentIntent.address
                );

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
                                paymentIntent.address,
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

                if (this.shadowRoot) {
                    this.shadowRoot.innerHTML = '<button><slot></slot></button>';
                }
                completedFn(paidEvent);
            });
        }
    }
}