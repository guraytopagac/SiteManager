// Libraries
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './style.css'

// Part 1: Render the main App component into the root element of the HTML document
createRoot(document.getElementById('root')).render(
  <App />
)