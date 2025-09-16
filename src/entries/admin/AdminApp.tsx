import { useState } from 'react'
import { OverloadButton } from '../../components/OverloadButton'
import { NothingSpecial } from '../../components/NothingSpecial'
import { BaseOnlyParent } from '../../components/BaseOnlyParent'

export default function AdminApp() {
  const [count, setCount] = useState(0)
  return (
    <div style={{ padding: 24 }}>
      <h1>Admin Area</h1>
      <p>This is a separate entrypoint mounted at /admin</p>
      <button onClick={() => setCount((c) => c + 1)}>Clicks: {count}</button>
      <OverloadButton />
      <NothingSpecial />
      <BaseOnlyParent />
    </div>
  )
}


