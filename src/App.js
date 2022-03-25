
import './App.css';
import React, {useState, useEffect, useRef, useMemo, useCallback} from 'react';
import Globe from 'react-globe.gl'
import * as d3 from 'd3'
import indexBy from "index-array-by";
import RG_stations_listed from "./data/RG_stations_listed.csv"
import RG_locations_listed from "./data/RG_locations_listed.csv"
import RG_metadata from "./data/RG_metadata.csv"
import ttulogo from "./ttu.png"
import SpaceDust from "./Components/SpaceDust"
import Pie from "./Components/Piechart";
import {flatten} from "lodash"

// [{ lat: 19.6, lng: 80, altitude: 0.6 },{ lat: 50, lng: 60, altitude: 0.4 },{ lat: 31.3037101, lng: -89.29276214, altitude: 0.4 },{ lat: 33.5842591, lng: -101.8804709, altitude: 0.6 }]
// const MAP_CENTERs = [{ lat: 87.5842591, lng: -70.8804709, altitude: 1.8 }];
const MAP_CENTERs = [{ lat: -92.52824601944323, lng: 38.31079101844495, altitude: 1.8 },{ lat: 51.58421865, lng: 45.9571029, altitude: 1.8 },{ lat: 31.3037101, lng: -89.29276214, altitude: 1.8 },{ lat: 33.5842591, lng: -101.8804709, altitude: 1.8 }];
// const MAP_CENTER = { lat: 33.5842591, lng: -101.8804709, altitude: 0.6 };
const OPACITY = 0.3;
const RING_PROPAGATION_SPEED = 1; // deg/sec

const arcThickScale = d3.scaleLinear().range([0.01,0.7]);
const contriesScale = d3.scaleLinear().range([0.1,0.7]);
const weightColor = d3.scaleSequentialSqrt(d3.interpolateYlOrRd)
    .domain([0, 1e7]);
const colorsCategory = (function(otherColor="#454545"){
    const scale = d3.scaleOrdinal(d3.schemeCategory10);
    let master = (val)=>{
        const domain = scale.domain();
        if (domain.find(d=>d===val)|| (domain.length<10))
            return scale(val);
        else
            return otherColor
    };
    master.domain = scale.domain;
    master.range = scale.range;
    return master;
})();
function App() {
    const globeEl = useRef();
    const [filterKeys, setfilterKeys] = useState({country:{"United States":true,"Brazil":true,"United Kingdom":true,"Spain":true,"France":true,"Italy":true,"Argentina":true,"Germany":true,"Colombia":true,"Mexico":true,"Canada":true,"Netherlands":true,"Russia":true,"Greece":true,"Australia":true}});
    const [logos, setLogos] = useState([]);
    const [rawData, setRawData] = useState({stationData:[],locationData:[],metaData:[]});
    const [locs, setLocs] = useState([]);
    const [constries, setConstries] = useState([]);
    const [genre, setGenre] = useState([]);
    const [stream_name, setStream_name] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [hoverArc, setHoverArc] = useState();
    const [selectPoint, setSelectPoint] = useState();
    const [currentSequnce,setCurrentSequnce] = useState(0);

    function handleData(stationData, locationData, metaData) {
        const groupByLocation = d3.groups(stationData, d => d["city_id"]);
        const range = d3.extent(groupByLocation, d => d[1].length);
        arcThickScale.domain(range);
        weightColor.domain([0, range[1]])
        // route
        const byLocName = indexBy(locationData, 'id', false);
        const metabyLocName = indexBy(metaData, 'city_id', true);

        const locs = groupByLocation.map(d => {
            const meta = metabyLocName[d[0]]??[];
            return {
                ...byLocName[d[0]],
                "title": `${byLocName[d[0]].title} - ${byLocName[d[0]].country}`,
                count: d[1].length,
                values: d[1],
                genre: d3.groups(meta,d=>d.stream_genre).map(d=>{d.title=d[0];d.count=d[1].length;return d}),
                stream_name: d3.groups(meta,d=>d.stream_name).map(d=>{d.title=d[0];d.count=d[1].length;return d}),
            }
        });
        locs.sort((a, b) => b.count - a.count);


        const constries = d3.groups(stationData, d => d["country"]).map(d => {
            return {
                "title": d[0],
                long: d3.mean(d[1], e => e.longitude),
                lat: d3.mean(d[1], e => e.latitude),
                count: d[1].length,
                values: d[1]
            }
        }).sort((a, b) => b.count - a.count);

        contriesScale.domain(d3.extent(constries, d => d.count));

        const genre = d3.groups(metaData, d => d["stream_genre"]).map(d => {
            return {
                "title": d[0],
                count: d[1].length,
                values: d[1]
            }
        }).sort((a, b) => b.count - a.count);

        const stream_name = d3.groups(metaData, d => d["stream_name"]).map(d => {
            return {
                "title": d[0],
                count: d[1].length,
                values: d[1]
            }
        }).sort((a, b) => b.count - a.count);

        //color
        colorsCategory.domain([]).range(d3.schemeCategory10);
        constries.forEach(d=>colorsCategory(d.title));

        let order = 0;
        [0,1,2,3,0].forEach(i=> {
            if (!MAP_CENTERs[order])
                MAP_CENTERs[order] = {lat:0,lng:0,altitude:1.8}
            MAP_CENTERs[order].lat = constries[i].lat;
            MAP_CENTERs[order].lng = constries[i].long;
            order++
        })
        return {locs, constries,genre,stream_name};
    }

    useEffect(() => {
        // load data
        Promise.all([
            d3.csv(RG_stations_listed),
            d3.csv(RG_locations_listed),
            d3.csv(RG_metadata),
        ]).then(([stationData,locationData,metaData]) => {
            locationData.forEach(d=>{
                d.long = d.geo_2;
                d.lat = d.geo_1;
                delete  d.geo_1;
                delete  d.geo_2;
            });
            const rawData = {stationData,locationData,metaData};
            filterdata(rawData);
            globeEl.current.pointOfView(MAP_CENTERs[0], 4000)
        });
    }, []);
    const filterdata = useCallback((_rawData=rawData)=>{
        let stationData = _rawData.stationData.slice();
        let locationData = _rawData.locationData.slice();
        let metaData = _rawData.metaData.slice();
        if (filterKeys){
            if (filterKeys.country){
                stationData = stationData.filter(d=>filterKeys.country[d.country]);
                locationData = locationData.filter(d=>filterKeys.country[d.country]);
                metaData = metaData.filter(d=>filterKeys.country[d.country]);
            }
            if (filterKeys.genre){
                metaData = metaData.filter(d=>filterKeys.country[d.genre]);
            }
        }
        const {locs, constries, genre,stream_name} = handleData(stationData, locationData,metaData);
        setLocs(locs);
        setConstries(constries);
        setGenre(genre)
        setStream_name(stream_name)
    },[filterKeys,rawData])
    useEffect(()=>{
        if (globeEl.current) {
            if (currentSequnce < MAP_CENTERs.length) {
                const interval = setTimeout(() => {
                    globeEl.current.pointOfView(MAP_CENTERs[currentSequnce], 4000)
                    setCurrentSequnce(currentSequnce + 1);
                }, 4000);
                return () => {
                    clearInterval(interval);
                };
            }
        }
    },[currentSequnce])
    function stopPlay(){
        setCurrentSequnce(MAP_CENTERs.length)
    }
    return  <div
        className="App"
        style={{
            background: "#000010",
            position: "relative"
        }}
    >
        <div style={{
            transform: "translate(-20%, 0)",
            width: '130wh'
        }}>
            <Globe
            ref={globeEl}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"


            // arcsData={routes}
            // arcLabel={d => `${d.name}`}
            // arcStartLat={d => +d.src.lat}
            // arcStartLng={d => +d.src.long}
            // arcEndLat={d => +d.dst.lat}
            // arcEndLng={d => +d.dst.long}
            // arcDashLength={0.4}
            // arcDashGap={0.8}
            // arcDashAnimateTime={d=>5000}
            // arcsTransitionDuration={1000}
            // arcStroke={d=>Math.sqrt(arcThickScale(d.data.length))}
            // arcColor={d => {
            //     const op = !hoverArc ? OPACITY : d === hoverArc ? 0.9 : OPACITY / 4;
            //     return [`rgba(0, 255, 0, ${op})`, `rgba(255, 0, 0, ${op})`];
            // }}

            // onArcHover={setHoverArc}

            // pointsData={locs}
            // pointColor={d => d.color??'orange'}
            // pointLat={d => d.lat}
            // pointLng={d => d.long}
            // pointAltitude={0}
            // pointRadius={d => arcThickScale(d.count)}
            // pointsMerge={true}

            labelsData={constries}
            labelLat={d => d.lat}
            labelLng={d => d.long}
            labelAltitude={d=>(selectPoint&&(selectPoint===d))?0.01:0.1}
            labelText={d => d['title']}
            labelSize={d => (selectPoint&&(selectPoint===d))?0.8:arcThickScale(d.count)/3}
            labelDotRadius={d => 0}
            labelColor={d => (selectPoint&&(selectPoint===d))?('#dd6700'):(d.color??'white')}
            labelResolution={2}

            hexBinPointsData={locs}
            hexBinPointWeight="count"
            hexBinPointLng={d => d.long}
            hexBinPointLat={d => d.lat}
            hexAltitude={d => arcThickScale(d.sumWeight)}
            hexBinResolution={4}
            hexTopColor={d => colorsCategory(d.points[0].country)}
            hexSideColor={d => colorsCategory(d.points[0].country)}

            hexBinMerge={true}
            hexLabel={d => {console.log(d); return `
            <b>${d.points.length}</b> stations:<ul><li>
              ${d.points.slice().sort((a, b) => b.count - a.count).map(d => d.title).join('</li><li>')}
            </li></ul>
          `}}

            // ringsData={[locs[locs.length-1]]}
            // ringLat={d => d.lat}
            // ringLng={d => d.long}
            // ringColor={() => t => `rgba(255,100,50,${1-t})`}
            // ringMaxRadius={d=>arcThickScale(d.count)*5}
            // ringPropagationSpeed={d=>arcThickScale(d.count)*RING_PROPAGATION_SPEED}

            // htmlElementsData={logos}
            // htmlLat={d => d.lat}
            // htmlLng={d => d.long}
            // htmlElement={<h1>We are here</h1>}
            onGlobeClick={stopPlay}
            />
        </div>
        <div
            style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                padding: "80px",
                display: "flex",
                alignItems: "center",
                flexDirection: "column"
            }}
        >
            <h2 style={{color:'white'}}>Top 15 countries</h2>
            <div style={{
                display: "flex",
                alignItems: "right",
                color: "#fff",
                // flexDirection: "column",
                height:'calc(100vh - 200px)',
                width:'100%',
                padding:'10px',
                position:'relative',
                overflowY:'auto',
                overflowX: 'hidden',
                background: '#ffffff0d',
                borderRadius:'5px',
                marginBottom:'10px',
                fontSize:'small',
            }} className="sc1">
                <div style={{width:'50%',height:'200px',position:'relative'}}>
                    <h3>Countries</h3>
                    <Pie
                        data={constries}
                        valueKey={(d)=>d.count}
                        displayText={(d,i)=>i<10?null:'none'}
                        colors={(d,i)=>colorsCategory(d.data.title)}
                        width={200}
                        height={200}
                        innerRadius={60}
                        outerRadius={100}
                        unit={'stations'}
                    />
                </div>
                <div style={{width:'50%',height:'200px'}}>
                    <h3>Genres</h3>
                    <Pie
                        data={genre}
                        displayText={(d,i)=>i<10?null:'none'}
                        colors={(d,i)=>i<10?'gray':'#454545'}
                        valueKey={(d)=>d.count}
                        width={200}
                        height={200}
                        innerRadius={60}
                        outerRadius={100}
                        unit={'streams'}
                    />
                </div>
                <div style={{width:'50%',height:'200px'}}>
                    <h3>Stream Names</h3>
                    <Pie
                        data={stream_name}
                        displayText={(d,i)=>i<10?null:'none'}
                        colors={(d,i)=>i<10?'gray':'#454545'}
                        valueKey={(d)=>d.count}
                        width={200}
                        height={200}
                        innerRadius={60}
                        outerRadius={100}
                        unit={'streams'}
                    />
                </div>
            </div>
            <div style={{
                display: "flex",
                alignItems: "center",
                fontSize: "60px",
                color: "#fff",
            }}
                 onClick={()=>{setCurrentSequnce(0)}}
            >
                {/*Radio Garden  <img src={ttulogo} width={"70px"} alt="Logo" />*/}
            </div>
        </div>
    </div>;
}

export default App;
