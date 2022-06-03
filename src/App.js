import { useState } from 'react';
import './App.css';
import Draw from 'ol/interaction/Draw';
import MapWrapper from './components/MapWrapper/MapWrapper';
import GeoJSON from 'ol/format/GeoJSON';
import LineString from 'ol/geom/LineString';
import Feature from 'ol/Feature';
import {Circle, Fill, Stroke, Style} from 'ol/style';
import createGraph from 'ngraph.graph';
import path from "ngraph.path";
import cogoToast from 'cogo-toast';
import MultiLineString from 'ol/geom/MultiLineString';
import {Vector as VectorLayer} from 'ol/layer';
import {Vector as VectorSource} from 'ol/source';
import { buffer, booleanPointInPolygon, point, toWgs84, toMercator} from '@turf/turf';

function App() {
  const [map, setMap] = useState(null);
  const [draw, setDraw] = useState(null);
  const [layerOfPoints, setLayerOfPoints] = useState(null);
  const [layerOfRoute, setLayerOfRoute] = useState(null);
  const [nodeCoordinates, setNodeCoordinates] = useState(null);
  const [links, setLinks] = useState(null);

  function addInteraction() {
    const vectorSource = new VectorSource({wrapX: false});
    const newLayerOfPoints = new VectorLayer({
      source: vectorSource
    });
    map.addLayer(newLayerOfPoints);
    setLayerOfPoints(newLayerOfPoints);

    const newDraw = new Draw({
      source: vectorSource,
      type: "Point",
    });

    setDraw(newDraw);
    
    const points = [];
    newDraw.on('drawend', (e) => {
      points.push(e.feature);

      if(points.length === 2) {
        map.removeInteraction(newDraw);
        const geoJson = (new GeoJSON()).writeFeaturesObject(points);

        (async function () {
          try {
            const response = await fetch("http://localhost:3000/getGrid", {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json;charset=utf-8'
              },
              body: JSON.stringify(geoJson),
            });
            
            if(response.ok) {
              const links = await response.json();
              setLinks(links);

              let coordinates = {};
              for(let link of links) {
                coordinates = {...coordinates, [link.startId]: link.coordinateStart, [link.endId]: link.coordinateEnd};
              }
              setNodeCoordinates(coordinates);

              addGrid(links, newLayerOfPoints);
            } else {
              cogoToast.warn("Проблема с сервером");
            }
          } catch(e) {
            cogoToast.error(e.message);
            console.log(e)
          }        
        })();
      }
    });

    map.addInteraction(newDraw);
  }

  function getFeatureOfRoute(links, foundPath) {
    const arrayOfCoord = [];
    foundPath.forEach(node => {
      arrayOfCoord.push(nodeCoordinates[node.id]);
    });

    const multiLineString = new MultiLineString([arrayOfCoord]);
    const feature =  new Feature({geometry: multiLineString});
    const fetureStyle = new Style({
      stroke: new Stroke({
        color: "#A020F0",
        width: 5,
      }),
    });

    feature.setStyle(fetureStyle);

    return feature;
  }

  function addGrid(links, layer) {
    for(let link of links) {
      const lineString = new LineString([link.coordinateStart, link.coordinateEnd]);
      const feature =  new Feature({geometry: lineString});
      const fetureStyle = new Style({
        stroke: new Stroke({
          color: link.color,
          width: link.width,
        }),
      });
    
      feature.setStyle(fetureStyle);
      layer.getSource().addFeature(feature);
    }
  }

  function addPoints() {
    if(draw != null) {
      map.removeInteraction(draw);
    }

    if(layerOfPoints || layerOfRoute) clearMap();
    addInteraction();
  }

  function clearLayer(layer) {
    if(layer) {
      const features = layer.getSource().getFeatures();
      features.forEach((feature) => {
        layer.getSource().removeFeature(feature);
      });
    }
  }

  function clearMap() {
    clearLayer(layerOfPoints);
    clearLayer(layerOfRoute);
    setLayerOfPoints(null);
    setLayerOfRoute(null);
  }

  function findPath(links, fromNodeId, toNodeId) {
    const graph = createGraph();
    for(let link of links) {
      graph.addLink(link.startId, link.endId, {weight: link.weight});
    }

    const pathFinder = path.aStar(graph, {
      distance(fromNode, toNode, link) {
        return link.data.weight;
      }
    });

    let foundPath = [];
    try {
      foundPath = pathFinder.find(fromNodeId, toNodeId);
    } catch (e) {
      cogoToast.error(e.message);
    }

    return foundPath;
  }

  function buildRoute() {
    if(layerOfRoute) return;

    const newDraw = new Draw({
      source: layerOfPoints.getSource(),
      type: "Point",
    
    });
    map.addInteraction(newDraw);
    
    const points = [];
    newDraw.on('drawend', (e) => {
      const coordOfPoint = e.feature.getGeometry().flatCoordinates;
      points.push(coordOfPoint);

      if(points.length === 2) {
        map.removeInteraction(newDraw)
        
        const firstPoint = toWgs84(point(points[0]));
        const secondPoint = toWgs84(point(points[1]));

        console.log(firstPoint);

        console.log(points[0]);
        console.log(points[1]);

        const bufferOfFristPoint = toMercator(buffer(firstPoint, 500, {units: "meters"}));
        const bufferOfSecondPoint = toMercator(buffer(secondPoint, 500, {units: "meters"}));

        const bufferFeatureFirts = (new GeoJSON()).readFeature(bufferOfFristPoint);
        const bufferFeatureSecond = (new GeoJSON()).readFeature(bufferOfSecondPoint);

        layerOfPoints.getSource().addFeature(bufferFeatureFirts);
        layerOfPoints.getSource().addFeature(bufferFeatureSecond);

        const arrayOfPointInFirstBuffer = [];
        const arrayOfPointInSecondBuffer = [];
        
        for(let [id, coordinate] of Object.entries(nodeCoordinates)) {
          const pointOfNode = point(coordinate);

          const isInFirstBuffer = booleanPointInPolygon(pointOfNode, bufferOfFristPoint);
          if(isInFirstBuffer) arrayOfPointInFirstBuffer.push({id, coordinate});

          const isInSecondBuffer = booleanPointInPolygon(pointOfNode, bufferOfSecondPoint);
          if(isInSecondBuffer) arrayOfPointInSecondBuffer.push({id, coordinate});
        }

        if(arrayOfPointInFirstBuffer.length === 0 || arrayOfPointInSecondBuffer.length === 0) {
          return cogoToast.error("Кратчайший путь не найден");
        }
        
        const foundPath = findPath(links, arrayOfPointInFirstBuffer[0].id, arrayOfPointInSecondBuffer[0].id);
        const fetureOfRoute = getFeatureOfRoute(links, foundPath);
        const newlayerOfRoute = new VectorLayer({
          source: new VectorSource({
              features: [fetureOfRoute]
          })
        });
        map.addLayer(newlayerOfRoute);
        setLayerOfRoute(newlayerOfRoute);
      }
    });
  }

  return (
    <div className="wrapper">
      <main className='main'>
        <div className='main__sidebar'>
          <button className='main__addBtn main__btn' onClick={addPoints}>Добавить точки</button>
          <button className='main__addBtn main__btn' onClick={buildRoute}>Построить маршрут</button>
          <button className='main__clrBtn main__btn' onClick={clearMap}>Очистить карту</button>
          <div className='main__layers'>
            <div className='main__layers-title'>Слои</div>
            <button className='layers__btn' onClick={() => layerOfPoints && layerOfPoints.setVisible(!layerOfPoints.get("visible"))}>
              Слой сетки
              <i className="gg-eye"></i>
            </button>
            <button className='layers__btn' onClick={() => layerOfRoute && layerOfRoute.setVisible(!layerOfRoute.get("visible"))}>
              Слой маршрута
              <i className="gg-eye"></i>
            </button>
          </div>
        </div>
        <div className='main__body'>
          <MapWrapper setParentMap={setMap}/>
          {/* <MapWrapper setParentMap={setMap} setParentSource={setSource} setParentLayer={setLayer}/> */}
        </div>
      </main>
    </div>
  );
}

export default App;
