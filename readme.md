# Installation

```shell
npm i @lexxsoft/usei18n
```

# Using

```js
import {createApp} from 'vue'
import App from './App.vue'
import {i18n} from '@lexxsoft/usei18n'

const app = createApp(App)
app.use(i18n, {translationUrl: '/api/translations'})
app.mount('#app')
```

In component
```js
import {useI18n} from "@lexxsoft/usei18n";

const $t = useI18n().t
console.log($t('passwords.reset'))
```
