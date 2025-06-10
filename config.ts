import fs from 'node:fs'
import yaml from 'js-yaml'

const config = yaml.load(
	fs.readFileSync('sidekick.config.yml', 'utf8')
) as Record<string, unknown>

export default config
