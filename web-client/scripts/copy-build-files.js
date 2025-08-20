import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Paths
const webClientRoot = path.resolve(__dirname, '..')
const distDir = path.join(webClientRoot, 'dist')
const projectRoot = path.resolve(webClientRoot, '..')
const templatesDir = path.join(projectRoot, 'packages/opencode/src/server/templates')
const staticDir = path.join(projectRoot, 'packages/opencode/src/server/static')

// Ensure directories exist
if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true })
}
if (!fs.existsSync(staticDir)) {
  fs.mkdirSync(staticDir, { recursive: true })
}

console.log('📦 Copying built files...')

try {
  // Read the built HTML file and modify it
  const htmlPath = path.join(distDir, 'index.html')
  if (!fs.existsSync(htmlPath)) {
    throw new Error('Built HTML file not found. Make sure to run build first.')
  }
  
  let htmlContent = fs.readFileSync(htmlPath, 'utf8')
  
  // Replace the vite asset paths to point to the static directory
  htmlContent = htmlContent.replace(/src="\/assets\/([^"]+\.js)"/g, 'src="{{BASE_URL}}/web/static/app.js"')
  
  // Replace CSS link with inlined styles
  const cssFiles = fs.readdirSync(path.join(distDir, 'assets')).filter(f => f.endsWith('.css'))
  if (cssFiles.length > 0) {
    const cssPath = path.join(distDir, 'assets', cssFiles[0])
    const cssContent = fs.readFileSync(cssPath, 'utf8')
    
    // Replace the CSS link with inlined styles
    htmlContent = htmlContent.replace(
      /<link rel="stylesheet"[^>]*href="\/assets\/[^"]+\.css"[^>]*>/g,
      `<style>\n${cssContent}\n</style>`
    )
  }
  
  // Write the modified HTML to templates
  const outputHtmlPath = path.join(templatesDir, 'web-app.html')
  fs.writeFileSync(outputHtmlPath, htmlContent)
  console.log('✅ Updated web-app.html')
  
  // Copy the JS file to static directory
  const jsFiles = fs.readdirSync(path.join(distDir, 'assets')).filter(f => f.endsWith('.js'))
  if (jsFiles.length > 0) {
    const jsPath = path.join(distDir, 'assets', jsFiles[0])
    const outputJsPath = path.join(staticDir, 'app.js')
    fs.copyFileSync(jsPath, outputJsPath)
    console.log('✅ Updated app.js')
  }
  
  console.log('🎉 Build files copied successfully!')
  console.log('📍 Files updated:')
  console.log(`   - ${outputHtmlPath}`)
  console.log(`   - ${path.join(staticDir, 'app.js')}`)
  
} catch (error) {
  console.error('❌ Error copying files:', error.message)
  process.exit(1)
}