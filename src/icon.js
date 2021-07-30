import { library } from "@fortawesome/fontawesome-svg-core"
import { faCog, faEdit, faList, faPause, faPlay, faPlus, faSignInAlt, faSignOutAlt, faTachometerAlt, faTrash } from "@fortawesome/free-solid-svg-icons"
//import { fa } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome"

// Add Free Font Awesome Icons here
// https://fontawesome.com/v5.15/icons?d=gallery&p=2&s=solid&m=free
library.add(faCog, faTachometerAlt, faEdit, faPlus, faPause, faPlay, faTrash, faList, faSignInAlt, faSignOutAlt)

export { FontAwesomeIcon }
