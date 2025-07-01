import { useState } from 'react'
import styles from './DynamicButton.module.css'

export default function DynamicButton() {
  const [clicks, setClicks] = useState(0)
  
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Dynamically Loaded Component!</h3>
      <button 
        className={styles.button}
        onClick={() => setClicks(c => c + 1)}
      >
        Dynamic Button Clicked: {clicks} times
      </button>
      <p className={styles.description}>
        This component was loaded via dynamic import with its own CSS chunk
      </p>
    </div>
  )
}