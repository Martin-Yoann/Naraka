import '../lib/config.mjs';
import {userPreferences} from '../lib/user-preferences.mjs';
import {closeCloud} from '../lib/cloud-db.mjs';
import {deliverPreferenceMessages} from '../lib/user-delivery.mjs';
try{console.log('Account lottery preference check:',await userPreferences().evaluate());console.log('WeChat delivery:',await deliverPreferenceMessages())}finally{await closeCloud()}
