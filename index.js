const fs = require("fs")
const path = require("path")
const Table = require("cli-table")
const colors = require("colors")

const table = new Table({
  head: [colors.green("JS files"), "Size(JS)"],
  colWidths: [70, 30],
})

const extArr = [".js", ".gz", ".br"]
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

const p = path.join(__dirname, ".")
walk(p, extArr, cb)

function cb(err, res) {
  const size = res.map(e => getFilesizeInBytes(e)).reduce((ac, e) => ac + (+e), 0)
  const arr = res.map(e => e.slice(__dirname.length + 1))
  table.push([arr.join("\n"), sizeFn(size)])
  console.log(table.toString())
}
function sizeFn(num) {
  if(num/1024 >= 1) {
    return `${ (num / 1024).toFixed(2) }MB`
  } else {
    return `${ num.toFixed(2) } KB`
  }
}

function getFilesizeInBytes(filename) {
  const stats = fs.statSync(filename)
  const fileSizeInKiloBytes = (stats["size"] / 1024).toFixed(2)
  return fileSizeInKiloBytes
}
