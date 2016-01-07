import fs from 'fs'
import log from 'npmlog'
import path from 'path'
import Promise from 'bluebird'
import { Spinner } from 'cli-spinner'
import Pkg from './pkg'

const cwd = process.cwd()
const spinner = new Spinner()

export function cli (args, testing = false, done) {
  const pkg = readPkg()
  const config = getPackageJSONConfigObject('napa-config')
  let pkgs
  if (args.length === 0) {
    pkgs = pkg
  } else if (pkg) {
    pkgs = args.map(parseArgs)
  } else {
    pkgs = []
  }
  if (!testing) {
    log.pause()
    spinner.start()
  }
  for (let i = 0; i < pkgs.length; i++) {
    pkgs[i] = parseArgs(pkgs[i][0])
  }
  Promise
    .map(pkgs, ([location, name, ref]) => new Pkg(location, name, ref, config).install().then((res) => {
      Promise.resolve(res)
    }))
    .then(() => spinner.stop(true))
    .then(() => log.resume())
    .then(done)
}

export function parseArgs (str) {
  let location, name, ref
  const split = str.split(':')
  let nameChanged = false

  location = str

  ref = location.replace(/^[^#]*#?/, '')

  if (location.slice(0, 1) === '/') {
    location = location.slice(1)
  }

  if (split.length === 3) {
    name = split[2]
    nameChanged = true
    location = split.slice(0, 2).join(':')
  } else if (split.length === 2) {
    if (location.indexOf('://') === -1 && location.indexOf('tags/') === -1) {
      name = split[1]
      location = 'git://github.com/' + location
      /*
      if (location.indexOf('#') !== -1) {
        const s = location.split('#')
        s[1] = s[1].slice(0, s[1].lastIndexOf(':'))
        location = `https://github.com/${s[0]}/archive/${s[1]}` + ((process.platform === 'win32') ? '.zip' : '.tar.gz')
      } else {
        location = 'git://github.com/' + location
      }
      */
    } else {
      name = location.slice(location.lastIndexOf('/') + 1)
    }
  } else {
    if (location.indexOf('://') === -1 && location.indexOf('tags/') === -1) {
      location = 'git://github.com/' + location
    }
    name = location.split('/')[location.split('/').length - 1]
    nameChanged = true
  }
  if (location.indexOf('#') !== -1) {
    if (location.lastIndexOf(':') < 7 && name.indexOf('#') !== -1) {
      name = name.slice(0, name.lastIndexOf('#'))
      nameChanged = true
    }
    location = location.slice(0, location.lastIndexOf('#'))
  }
  if (location.lastIndexOf(':') > 6) {
    ref = ref.slice(0, ref.lastIndexOf(':'))
    location = location.slice(0, location.lastIndexOf(':'))
  }
  if (ref.lastIndexOf(':') !== -1) {
    ref = ref.slice(0, ref.lastIndexOf(':'))
  }
  if (location.indexOf('/archive/') !== -1) {
    if (!nameChanged) {
      name = location.slice(0, location.indexOf('/archive/'))
      name = name.slice(name.lastIndexOf('/') + 1)
    }
    const point = (location.indexOf('.zip') === -1) ? location.indexOf('.tar.gz') : location.indexOf('.zip')
    ref = location.slice(location.lastIndexOf('/') + 1, point)
  }
  if (ref.indexOf('tags/') !== -1) {
    console.log(name)
    if (name.indexOf(':') === -1) {
      name = location.slice(location.lastIndexOf('/') + 1)
    } else {
      name = name.slice(name.lastIndexOf(':') + 1)
    }
    ref = ref.slice(ref.indexOf('/') + 1)
    location = `https://github.com/${location}/archive/${ref}.${((process.platform === 'win32') ? 'zip' : 'tar.gz')}`
  }
  if (ref === '') ref = 'master'
  return [location, name, ref]
}

function readPkg () {
  const repos = getPackageJSONConfigObject('napa')

  return Object.keys(repos).map((repoName) => {
    const repoLocation = repos[repoName]
    return [repoLocation, repoName]
  })
}

function getPackageJSONConfigObject (property) {
  const pkgPath = path.join(cwd, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    return {}
  }

  const pkg = require(pkgPath)
  if (pkg.hasOwnProperty(property)) {
    return pkg[property]
  }
}