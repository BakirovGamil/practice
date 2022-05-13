import { useState } from 'react';
import './App.css';
import Draw from 'ol/interaction/Draw';
import MapWrapper from './components/MapWrapper/MapWrapper';
import GeoJSON from 'ol/format/GeoJSON';

function App() {
  const [map, setMap] = useState(null);
  const [source, setSource] = useState(null);
  const [draw, setDraw] = useState(null);

  function addInteraction() {
    const newDraw = new Draw({
      source: source,
      type: "Point",
    });

    setDraw(newDraw);
    
    const points = [];
    newDraw.on('drawend', (e) => {
      const numberOfPoints = points.length;
      points.push(e.feature);
      console.log(points);

      if(numberOfPoints + 1 === 2) {
        map.removeInteraction(newDraw);
        const geoJson = (new GeoJSON()).writeFeaturesObject(points);
        console.log(geoJson);
      }
    });

    map.addInteraction(newDraw);
  }

  function handleClick() {
    if(draw != null) {
      map.removeInteraction(draw);
    }

    addInteraction();
  }

  return (
    <div className="wrapper">
      <main className='main'>
        <div className='main__sidebar'>
          <button className='main__addBtn' onClick={handleClick}>Добавить точки</button>
        </div>
        <div className='main__body'>
          <MapWrapper setParentMap={setMap} setParentSource={setSource}/>
        </div>
      </main>
    </div>
  );
}

export default App;
