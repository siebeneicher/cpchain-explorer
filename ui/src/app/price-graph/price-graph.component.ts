import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import * as d3 from 'd3';
import * as moment from 'moment';
import { environment } from '../../environments/environment';

@Component({
	selector: 'app-price-graph',
	templateUrl: './price-graph.component.html',
	styleUrls: ['./price-graph.component.scss'],
	encapsulation: ViewEncapsulation.None,
})
export class PriceGraphComponent implements OnInit {

	width:number;
	height:number;
	svg:any;
	timerange:any;
	timeranges:Array<any> = [];
	axisTicks:number = 3;

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
			{title: 'last 7 days', unit: "day", times: 7}
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
		d3.json(environment.backendBaseUrl+'/price-graph?unit='+tr.unit+'&times='+tr.times+'&exclude_last=0').then(_ => this.render(_));
	}

	filter (res) {
		//let data = res.data.map(_ => {return {y: _.transactions_count, ts: _.ts}});

		return {dataset: res.data, max: res.usd_avg_max};
	}

	clear () {
		d3.select("#price-graph-container > svg").remove();
	}

	render (res) {
		this.clear();

		if (!res) {
// TODO: no data available

			this.loading = -1;
			return;
		}

		const target = 'usd_avg';
		const {dataset, max} = this.filter(res);

		const container = document.querySelector("#price-graph-container");
		//const computed = window.getComputedStyle(container);

		// 2. Use the margin convention practice 
		const margin = {top: 25, right: 70, bottom: 25, left: 25};
		this.width = container.clientWidth - margin.left - margin.right;	 // Use the prrents's width 
		this.height = container.clientHeight - margin.top - margin.bottom;	 // Use the parents's height

		const bisectDate = d3.bisector(function(d) { return d.ts; }).left;

		// 5. X scale will use the index of our data
		const xScale = d3.scaleLinear()
		    .domain(d3.extent(dataset, function(d) { return d.ts; })) // input
		    .range([0, this.width]); // output

		// 6. Y scale will use the randomly generate number 
		const yScale = d3.scaleLinear()
		    .domain([0, max]) // input 
		    .range([this.height, 0]); // output 

		// 7. d3's line generator
		const line = d3.line()
		    .x(function(d, i) { return xScale(d.ts); }) // set the x values for the line generator
		    .y(function(d) { return yScale(d[target]); }) // set the y values for the line generator 
		    .curve(d3.curveMonotoneX) // apply smoothing to the line

		// 1. Add the SVG to the page and employ #2
		const svg = d3.select("#price-graph-container").append("svg")
		    .attr("width", this.width + margin.left + margin.right)
		    .attr("height", this.height + margin.top + margin.bottom)
		  .append("g")
		    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		// 3. Call the x axis in a group tag
		svg.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(0," + (this.height-10) + ")")
			.call(d3.axisBottom(xScale).tickSize(10).ticks(this.axisTicks).tickFormat(d => moment.utc(d*1000).format('DD MMMM')))
			.select(".domain").remove()

// 4. Call the y axis in a group tag
/*svg.append("g")
    .attr("class", "y axis")
    .call(d3.axisLeft(yScale)); // Create an axis component with d3.axisLeft
*/
/*svg.append("g")
	.attr("class", "y axis")
	.attr("transform", "translate("+(this.width-25) + ",0)")
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

		const last = list => list[list.length-1];

		// label last value
		const valueLabel = svg.selectAll(".label")
			  .data(dataset)
			.enter().append("g")
			  .attr("transform", d => `translate(${xScale(last(dataset).ts)}, ${yScale(last(dataset)[target])})`);

		valueLabel.append("circle")
			.attr("r", 3)
			.style("stroke", "white")
//			.style("fill", d => d.light);

		valueLabel.append("text")
			.text(d => "$"+last(dataset)[target])
			.attr("dy", 5)
			.attr("dx",10)
			.style("font-family", "Open Sans")
			.style("font-weight", "300")
			.style("fill", d => "#777");



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
		    .attr("r", 4)


		// MOUSE 
		svg.on("mouseover", function(a, b, c) { 
			    //this.attr('class', 'focus')
			})
		   .on("mouseout", function() {  })
		   .on("mousemove", mousemove);

		var focus = svg.append("g")
		   .attr("class", "focus")
		   .style("display", "none");

		focus.append("circle")
		    .attr("r", 3.5)
			.style("stroke", "orange")
			.style("fill", d => "white");

		focus.append("text")
		   .attr("x", -10)
		   .attr("y", -17)
		   .attr("dy", ".35em");

		svg.append("rect")
		   .attr("class", "overlay")
		   .attr("width", this.width)
		   .attr("height", this.height)
		   .on("mouseover", function() { focus.style("display", null); })
		   .on("mouseout", function() { focus.style("display", "none"); })
		   .on("mousemove", mousemove);

		function mousemove() {
			try {
				 var x0 = xScale.invert(d3.mouse(this)[0]),
				     i = bisectDate(dataset, x0, 1),
				     d0 = dataset[i - 1],
				     d1 = dataset[i],
				     d = x0 - d0.ts > d1.ts - x0 ? d1 : d0;
				 focus.attr("transform", "translate(" + xScale(d.ts) + "," + yScale(d[target]) + ")");
				 focus.select("text").text("$"+d[target]);
			} catch (e) {}
		}

		this.loading = -1;
	}

}
