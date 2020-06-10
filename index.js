#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const Table = require('cli-table')
const cliProgress = require('cli-progress')
const colors = require('colors')
const zlib = require('zlib')
const process = require('process')

const zlibSettings = {
  level: 9,
}

const extArr = ['.js', '.css', '.json', '.html', '.xml', '.woff2', '.map', '.svg', '.csv']

function compressToGzip(file) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(file)
    const res = file + '.gz'
    if (extArr.indexOf(ext) !== -1) {
      const fileContents = fs.createReadStream(file)
      const writeStream = fs.createWriteStream(res)
      const zip = zlib.createGzip(zlibSettings)
      fileContents
        .pipe(zip)
        .on('error', (err) => reject(err))
        .pipe(writeStream)
        .on('finish', () => resolve(res))
        .on('error', (err) => reject(err))
    } else {
      resolve()
    }
  })
}

function compressToBrotli(file) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(file)
    const res = file + '.br'
    if (extArr.indexOf(ext) !== -1) {
      const fileContents = fs.createReadStream(file)
      const writeStream = fs.createWriteStream(res)
      const br = zlib.createBrotliCompress(zlibSettings)
      fileContents
        .pipe(br)
        .on('error', (err) => reject(err))
        .pipe(writeStream)
        .on('finish', () => resolve(res))
        .on('error', (err) => reject(err))
    } else {
      resolve()
    }
  })
}

const table = new Table({
  head: [
    colors.green('Text files'),
    colors.green('Size(text files)'),
    colors.green('Size(gzip files)'),
    colors.green('Size(brotli files)'),
  ],
  colWidths: [70, 30, 30, 30],
})

const progressBar = new cliProgress.SingleBar(
  {
    format: 'progress [{bar}] {percentage}% | {value}/{total}',
  },
  cliProgress.Presets.shades_classic
)

const walk = function (dir, exts, done) {
  let results = []
  fs.readdir(dir, function (err, list) {
    if (err) return done(err)
    let pending = list.length
    if (!pending) return done(null, results)
    list.forEach(function (file) {
      file = path.resolve(dir, file)
      fs.stat(file, function (err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, exts, function (err, res) {
            results = results.concat(res)
            if (!--pending) done(null, results)
          })
        } else {
          const ext = path.extname(file)
          if (exts.indexOf(ext) !== -1) results.push(file)
          if (!--pending) done(null, results)
        }
      })
    })
  })
}

function cb(err, res) {
  const size = res.map((e) => getFilesizeInBytes(e)).reduce((ac, e) => ac + +e, 0)
  const cwd = process.cwd()
  const arr = res.map((e) => e.slice(cwd.length + 1))
  let p = Promise.resolve()
  const bSize = []
  const gSize = []
  let progressIdx = 0
  const progressSliceNum = res.length * 2
  progressBar.start(progressSliceNum, 0)
  for (let i = 0, len = res.length; i < len; i++) {
    p = p.then(() => {
      return compressToBrotli(res[i]).then((f) => {
        const s = getFilesizeInBytes(f)
        bSize[i] = s
        progressBar.update(++progressIdx)
        return s
      })
    })
  }

  for (let i = 0, len = res.length; i < len; i++) {
    p = p.then(() => {
      return compressToGzip(res[i]).then((f) => {
        const s = getFilesizeInBytes(f)
        gSize[i] = s
        progressBar.update(++progressIdx)
        return s
      })
    })
  }
  p.then(() => {
    progressBar.stop()
    const gSizeSum = gSize.reduce((ac, e) => ac + +e, 0)
    const bSizeSum = bSize.reduce((ac, e) => ac + +e, 0)
    table.push([
      arr.join('\n'),
      sizeFn(size),
      sizeFn(gSizeSum) + `(${delta(size, gSizeSum)})`,
      sizeFn(bSizeSum) + `(${delta(gSizeSum, bSizeSum)})`,
    ])
    console.log(table.toString())
  })
}

function delta(a, b) {
  const sign = a > b ? '-' : a === b ? '' : '+'
  const num = ((b - a) / a) * 100
  const res = num.toFixed(2) + '%'
  return a > b ? colors.green(res) : a === b ? res : colors.red(res)
}

function sizeFn(num) {
  if (num / 1024 >= 1) {
    return `${(num / 1024).toFixed(2)}MB`
  } else {
    return `${num.toFixed(2)} KB`
  }
}

function getFilesizeInBytes(filename) {
  const stats = fs.statSync(filename)
  const fileSizeInKiloBytes = (stats['size'] / 1024).toFixed(2)
  return fileSizeInKiloBytes
}

walk(process.cwd(), extArr, cb)
