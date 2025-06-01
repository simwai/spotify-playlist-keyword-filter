const fs = require('fs')
const path = require('path')

// Create dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist')
}

// Copy all src files to dist
const srcDir = path.join(__dirname, '../src')
const distDir = path.join(__dirname, '../dist')

function copyRecursiveSync(src, dest) {
  const stats = fs.statSync(src)
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest)
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      )
    })
  } else {
    const content = fs.readFileSync(src)
    fs.writeFileSync(dest, content)
  }
}
copyRecursiveSync(srcDir, distDir)

console.log('✅ Frontend built successfully for GitHub Pages')
