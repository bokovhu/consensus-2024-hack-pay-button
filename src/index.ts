import { PayButton } from "./PayButton";

function initPayButtonCustomElement() {
    if (!window.customElements) {
        console.error('Custom Elements are not supported in this browser');
        return;
    }
    const customElements = window.customElements;
    customElements.define(
        'pay-button',
        PayButton
    );
    console.log('PayButton custom element defined', customElements.get('pay-button'));
}

initPayButtonCustomElement();
