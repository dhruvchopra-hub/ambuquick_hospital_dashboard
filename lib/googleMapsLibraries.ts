// Stable reference required by @react-google-maps/api — must NOT be defined inside a component
// All useJsApiLoader calls must use this same constant to avoid "Loader called with different options" error
import type { Libraries } from '@react-google-maps/api'

export const GOOGLE_MAPS_LIBRARIES: Libraries = ['places']
