import { initFederation } from './app/utils/init-federation';

// TODO: Make sure this package exists

initFederation(undefined, {
  cdnPattern: 'http://localhost:4200/{package}@{version}'
})
  .catch(err => console.error(err))
  .then(_ => import('./bootstrap'))
  .catch(err => console.error(err));
