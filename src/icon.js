import { library } from '@fortawesome/fontawesome-svg-core'
//import { fa } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCog, faTachometerAlt, faEdit, faPlus, faPause, faPlay, faTrash, faList } from '@fortawesome/free-solid-svg-icons'

// Add Free Font Awesome Icons here
// https://fontawesome.com/v5.15/icons?d=gallery&p=2&s=solid&m=free
library.add(faCog, faTachometerAlt, faEdit, faPlus, faPause, faPlay, faTrash, faList)

export {
    FontAwesomeIcon
}
