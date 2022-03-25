import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

const Pie = ({top=10,...props}) => {
    const ref = useRef(null);
    const divref = useRef(null);
    const cache = useRef(props.data);
    const createPie = d3
        .pie()
        .value(props.valueKey??(d => d.value))
        .sort(null);
    const createArc = d3
        .arc()
        .innerRadius(props.innerRadius)
        .outerRadius(props.outerRadius);
    const colors = props.colors??d3.scaleOrdinal(d3.schemeCategory10);
    const format = d3.format(",d");

    useEffect(
        () => {
            const data = createPie(props.data);
            const prevData = createPie(cache.current);
            const group = d3.select(ref.current);

            let summary = group.select('g.Summary');
            if (summary.empty()){
                summary = group.append('g').attr('class','Summary').style('fill','white');
                summary.append('text').attr('class','Summary1')
                    .style('font-size','30px')
                    .style('text-anchor','middle');
                summary.append('text').attr('class','Summary2')
                    .style('font-size','small')
                    .style('text-anchor','middle')
                    .style('alignment-baseline','text-before-edge');
            }
            // summary.attr('transform',`translate(${props.width/2},${props.height/2})`);
            summary.select('text.Summary1').text(format(d3.sum(data,d=>d.value)));
            summary.select('text.Summary2').text(props.unit);
            const groupWithData = group.selectAll("g.arc").data(data);

            groupWithData.exit().remove();

            const groupWithUpdate = groupWithData
                .enter()
                .append("g")
                .attr("class", "arc");

            const path = groupWithUpdate
                .append("path")
                .merge(groupWithData.select("path.arc"));

            const arcTween = (d, i) => {
                const interpolator = d3.interpolate(prevData[i], d);

                return t => createArc(interpolator(t));
            };

            path
                .attr("class", "arc")
                .attr("fill", (d, i) => colors(d,i))
                .transition()
                .attrTween("d", arcTween);

            const text = groupWithUpdate
                .append("text")
                .merge(groupWithData.select("text"));

            text
                .attr("text-anchor", "middle")
                .attr("alignment-baseline", "middle")
                .style("fill", "white")
                .style("font-size", 10)
                .style('display',(d,i)=>props.displayText?props.displayText(d,i):null)
                .transition()
                .attr("transform", d => `translate(${createArc.centroid(d)})`)
                .tween("text", (d, i, nodes) => {
                    const interpolator = d3.interpolate(prevData[i], d);

                    return t => d3.select(nodes[i]).text(format(interpolator(t).value));
                });

            let list = data.slice(0,top);
            const topScale = d3.scaleLinear().domain(d3.extent(list,d=>d.value)).range([10,100])
            const divg = d3.select(divref.current);
            const divWithData = divg.selectAll("div.bar").data(list);
            divWithData.exit().remove();

            const divWithUpdate = divWithData
                .enter()
                .append("div")
                .attr("class", "bar")
                .style('width','100%')
                .style('padding','1px')
                .style('display',"flex");
            const name = divWithUpdate
                .append("div")
                .attr('class','title')
                .style('width','50%')
                .style('text-align',"right")
                .style('padding','2px')
                .style('text-overflow', "ellipsis")
                .style('white-space', "nowrap")
                .style('overflow', "hidden")
                .merge(divWithUpdate.select("div.title"))
                .style('opacity',d=>(d.data.title.trim()!=='')?null:0.3)
                .text(d=>d.data.title.trim()!==''?d.data.title:"Not listed")
                .attr('title',d=>d.data.title.trim()!==''?d.data.title:"Not listed");
            const processnew = divWithUpdate
                .append("div")
                .attr('class','process')
                .style('width','50%')
                .style('height',"100%")
                .style('background','black')
                .style('position', "relative")
                .style('border-radius', "10px");
            let newPin = processnew.append('div')
                .attr('class','processInside')
                .style('width','0')
                .style('height',"100%")
                .style('position', "absolute")
                .style('border-radius', "10px");
            newPin.append('span');

            let process = processnew
                .merge(divWithUpdate.select("div.process"));
            process.selectAll('div.processInside')
                .style('background-color',(d,i)=>colors(d,i))
                .style('width',d=>`${topScale(d.value)}%`)
                .selectAll('span')
                .text(d=>format(d.value))

            cache.current = props.data;
        },
        [props.data]
    );

    return (
        <>
        <svg width={props.width} height={props.height}>
            <g
                ref={ref}
                transform={`translate(${props.outerRadius} ${props.outerRadius})`}
            />
        </svg>
        <div ref={divref} style={{
            display: "flex",
            alignItems: "right",
            color: "#fff",
            flexDirection: "column",
            height:'calc(100vh - 490px)',
            width:'90%',
            padding:'10px',
            position:'relative',
            overflowY:'auto',
            overflowX: 'hidden',
            background: '#ffffff0d',
            borderRadius:'5px',
            marginBottom:'10px',
            fontSize:'small',
        }} className={"sc1"}>

        </div>
            <h5 style={{marginTop:15,marginBottom:2}}>Total = {format(d3.sum(props.data.slice(0,top),d=>d.count))} {props.unit}</h5>
            {/*{props.data.slice(0,10).map(d=><div key={d['title']} style={{width:'100%', padding: '1px', display: "flex"}}*/}
            {/*>*/}
            {/*    <div style={{width:'30%', textAlign:"right",padding:'2px',textOverflow: "ellipsis",whiteSpace: "nowrap",overflow: "hidden"}}>{d['title']}</div>*/}
            {/*    <div style={{width:'70%',height:'100%',background:'black',position:'relative',borderRadius:'10px'}}>*/}
            {/*        <div style={{width:`${d.count*100}%`,height:'100%',background:(selectPoint&&(selectPoint===d))?'#dd6700':'orange',position:'absolute',borderRadius:'10px'}}>*/}
            {/*            <span>{d.count}</span>*/}
            {/*        </div>*/}
            {/*    </div>*/}
            {/*</div>)}*/}
        </>
    );
};

export default Pie;
