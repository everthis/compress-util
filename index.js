const fs = require('fs')
const path = require('path')
const Table = require('cli-table')
const colors = require('colors')
const brotli = require('brotli')
const zlib = require('zlib')
const { promisify } = require('util')

const brotliSettings = {
  extension: 'br',
  skipLarger: true,
  mode: 1, // 0 = generic, 1 = text, 2 = font (WOFF2)
  quality: 11, // 0 - 11,
  lgwin: 12, // default
}

const gzipSettings = {
  level: 9,
}

const extArr = ['.js', '.css', '.json', '.html']
function compression(file) {
  if (file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.html')) {
    // brotli
    const result = brotli.compress(fs.readFileSync(file), brotliSettings)
    fs.writeFileSync(file + '.br', result)
    // gzip
    const fileContents = fs.createReadStream(file)
    const writeStream = fs.createWriteStream(file + '.gz')
    const zip = zlib.createGzip(gzipSettings)
    fileContents
      .pipe(zip)
      .on('error', (err) => console.error(err))
      .pipe(writeStream)
      .on('close', (err) => console.log('done'))
      .on('error', (err) => console.error(err))
  }
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

const p = path.join(__dirname, '.')
walk(p, extArr, cb)

function cb(err, res) {
  const size = res
    .map((e) => getFilesizeInBytes(e))
    .reduce((ac, e) => ac + +e, 0)
  const arr = res.map((e) => e.slice(__dirname.length + 1))
  table.push([arr.join('\n'), sizeFn(size)])
  console.log(table.toString())
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

compression(path.join(__dirname, 'index.js'))
