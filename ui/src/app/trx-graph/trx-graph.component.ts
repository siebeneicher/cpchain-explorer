import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import * as d3 from 'd3';
import * as moment from 'moment';
import { environment } from '../../environments/environment';


@Component({
  selector: 'app-trx-graph',
  templateUrl: './trx-graph.component.html',
  styleUrls: ['./trx-graph.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class TrxGraphComponent implements OnInit {


	width:number = 1400;
	height:number = 600;
	svg:any;
	limit:number = 10;
	timerange:any;
	timeranges:Array<any> = [];
	axisTicks:number = 5;

	unit:string;
	times:number;

	loading:number = -1;

	//hover_tooltip:any;
	//hovered_stream:string = "";
	mouse_x:number;
	mouse_y:number;


	constructor() { }

	ngOnInit() {
	}

	ngAfterContentInit() {
		this.timeranges = [
			{title: 'last 2 weeks', unit: "day", times: 14}
		];
		this.setTimerange(0);
	}
	ngAfterViewInit () {
		//this.attachTooltipToDocument();
	}
	attachTooltipToDocument () {
		//document.body.appendChild(document.querySelector(".stream-container-hovertooltip"));
		//this.hover_tooltip = document.querySelector(".stream-container-hovertooltip");
	}
	setTimerange (index) {
		this.timerange = index;
		this.reload();
	}

	reload () {
		this.loading = this.timerange;
		const tr = this.timeranges[this.timerange];
		d3.json(environment.backendBaseUrl+'/transactions-graph?unit='+tr.unit+'&times='+tr.times).then(_ => this.render(_));
	}

	filter (res) {
		//let data = res.data.map(_ => {return {y: _.transactions_count, ts: _.ts}});

		return {dataset: res.data, max: res.count_max};
	}

	clear () {
		d3.select("#trx-graph-container > svg").remove();
	}

	render (res) {
		this.clear();

		if (!res) {
// TODO: no data available

			this.loading = -1;
			return;
		}

		const axisTicks = 5;
		const target = 'transactions_count';
		const {dataset, max} = this.filter(res);

		const container = document.querySelector("#trx-graph-container");

// 2. Use the margin convention practice 
var margin = {top: 25, right: 50, bottom: 25, left: 25}
  , width = container.clientWidth - margin.left - margin.right // Use the window's width 
  , height = container.clientHeight - margin.top - margin.bottom; // Use the window's height


// 5. X scale will use the index of our data
var xScale = d3.scaleLinear()
    .domain(d3.extent(dataset, function(d) { return d.ts; })) // input
    .range([0, width]); // output

// 6. Y scale will use the randomly generate number 
var yScale = d3.scaleLinear()
    .domain([0, max]) // input 
    .range([height, 0]); // output 

// 7. d3's line generator
var line = d3.line()
    .x(function(d, i) { return xScale(d.ts); }) // set the x values for the line generator
    .y(function(d) { return yScale(d[target]); }) // set the y values for the line generator 
    .curve(d3.curveMonotoneX) // apply smoothing to the line

// 1. Add the SVG to the page and employ #2
var svg = d3.select("#trx-graph-container").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// 3. Call the x axis in a group tag
svg.append("g")
	.attr("class", "x axis")
	.attr("transform", "translate(0," + (height-25) + ")")
	.call(d3.axisBottom(xScale).tickSize(25).ticks(axisTicks).tickFormat(d => moment.utc(d*1000).format('DD MMMM')))
	.select(".domain").remove()

// 4. Call the y axis in a group tag
/*svg.append("g")
    .attr("class", "y axis")
    .call(d3.axisLeft(yScale)); // Create an axis component with d3.axisLeft
*/
/*svg.append("g")
	.attr("class", "y axis")
	.attr("transform", "translate("+(width-25) + ",0)")
	.call(d3.axisLeft(yScale).tickSize(25).ticks(3).tickFormat(d => d[target]))*/

/*svg
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y))
    .call(svg => svg.select(".domain").remove())
    .call(svg => svg.select(".tick:last-of-type text").clone()
        .attr("x", 3)
        .attr("text-anchor", "start")
        .attr("font-weight", "bold")
        .text("huhu"))
*/

let last = list => list[list.length-1];

// label last value
const valueLabel = svg.selectAll(".label")
	  .data(dataset)
	.enter().append("g")
	  .attr("transform", d => `translate(${xScale(last(dataset).ts)}, ${yScale(last(dataset)[target])})`);

valueLabel.append("circle")
	.attr("r", 4)
	.style("stroke", "white")
	.style("fill", d => d.light);

valueLabel.append("text")
	.text(d => last(dataset)[target])
	.attr("dy", 5)
	.attr("dx", 10)
	.style("font-family", "monospace")
	.style("fill", d => d.dark);



// 9. Append the path, bind the data, and call the line generator 
svg.append("path")
    .datum(dataset) // 10. Binds data to the line 
    .attr("class", "line") // Assign a class for styling 
    .attr("d", line); // 11. Calls the line generator 

// 12. Appends a circle for each datapoint 
svg.selectAll(".dot")
    .data(dataset)
  .enter().append("circle") // Uses the enter().append() method
    .attr("class", "dot") // Assign a class for styling
    .attr("cx", function(d, i) { return xScale(d.ts) })
    .attr("cy", function(d) { return yScale(d[target]) })
    .attr("r", 5)
/*      .on("mouseover", function(a, b, c) { 
  			console.log(a) 
        this.attr('class', 'focus')
		})
      .on("mouseout", function() {  })
       .on("mousemove", mousemove);

   var focus = svg.append("g")
       .attr("class", "focus")
       .style("display", "none");

   focus.append("circle")
       .attr("r", 4.5);

   focus.append("text")
       .attr("x", 9)
       .attr("dy", ".35em");

   svg.append("rect")
       .attr("class", "overlay")
       .attr("width", width)
       .attr("height", height)
       .on("mouseover", function() { focus.style("display", null); })
       .on("mouseout", function() { focus.style("display", "none"); })
       .on("mousemove", mousemove);
  
   function mousemove() {
     var x0 = x.invert(d3.mouse(this)[0]),
        i = bisectDate(data, x0, 1),
         d0 = data[i - 1],
         d1 = data[i],
         d = x0 - d0.date > d1.date - x0 ? d1 : d0;
     focus.attr("transform", "translate(" + x(d.date) + "," + y(d.close) + ")");
     focus.select("text").text(d);
   }*/

		this.loading = -1;
	}

}
