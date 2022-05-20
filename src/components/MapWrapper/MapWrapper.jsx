import { useEffect, useRef } from "react";
import "./MapWrapper.css";
import "ol/src/ol.css";
import {Map, View} from 'ol';
import {fromLonLat} from 'ol/proj';
import {Tile as TileLayer,  Vector as VectorLayer} from 'ol/layer';
import {OSM,  Vector as VectorSource} from 'ol/source';

function MapWrapper({setParentMap, setParentSource, setParentLayer}) {
    const mapContainerRef = useRef();

    useEffect(() => {
        const mapContainer = mapContainerRef.current;
        
        const raster = new TileLayer({
          source: new OSM(),
        });
        
        const source = new VectorSource({wrapX: false});
        
        const vector = new VectorLayer({
          source: source,
        });

        const map = new Map({
            target: mapContainer,
            layers: [raster, vector],
            view: new View({
              projection: 'EPSG:3857',
              center: fromLonLat([30.3, 59.9], "EPSG:3857"),
              zoom: 12
            })
        });

        setParentMap(map);
        // setParentSource(source);
        // setParentLayer(vector);

        return () => {
          mapContainer.innerHTML = "";
        }
      }, []);

    return ( 
        <div className="map-wrapper" ref={mapContainerRef}></div>
    );
}
 
export default MapWrapper;