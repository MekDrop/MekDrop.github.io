import yaml from 'yaml';
import enUS from './en-US.yml?raw'
import ltLT from './lt.yml?raw'

export default {
  'en-US': yaml.parse(enUS),
  'lt': yaml.parse(ltLT),
}
