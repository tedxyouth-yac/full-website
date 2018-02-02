(function() {
  'use strict';

  var elements = stripe.elements({
    fonts: [
      {
        cssSrc: 'https://fonts.googleapis.com/css?family=Roboto',
      },
    ],

    locale: window.__exampleLocale // Stops localization
  });

  var card = elements.create('card', {
    iconStyle: 'solid',
    style: {
      base: {
        iconColor: '#c4f0ff',
        color: '#fff',
        fontWeight: 500,
        fontFamily: 'Roboto, Open Sans, Segoe UI, sans-serif',
        fontSize: '15px',
        fontSmoothing: 'antialiased',

        ':-webkit-autofill': {
          color: '#fce883',
        },
        '::placeholder': {
          color: '#BDBDBD',
        },
      },
      invalid: {
        iconColor: '#ffff1a',
        color: '#ffff1a',
      },
    },
  });
  card.mount('#example1-card');

  registerElements([card], 'example1');
})();
