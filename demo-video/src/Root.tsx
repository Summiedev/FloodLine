import { Composition } from 'remotion'
import { FloodLineDemo } from './FloodLineDemo'

export const Root = () => <Composition
  id="FloodLineDemo"
  component={FloodLineDemo}
  durationInFrames={2400}
  fps={30}
  width={1920}
  height={1080}
/>
