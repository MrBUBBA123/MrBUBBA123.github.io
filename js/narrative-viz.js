// ===== DATA =====
let concussionData = [];
let practiceField, gameField, totalField;

// ===== DATA LOADING ===== 
async function loadConcussionData() 
{
    try {
        const data = await d3.csv("data/NFL Concussion 2015-2023.csv");
        
        const processedData = data.map(d => {
            return {
                year: +d.Year,
                // preseason
                preseasonPractice: +d["Preseason_Practice"],
                preseasonGame: d["Preseason_Game"] === "N/A" ? 0 : +d["Preseason_Game"], 
                preseasonTotal: +d["Preseason_Total"],
                // regular season  
                regularSeasonPractice: +d["Regular_Practice"],
                regularSeasonGame: +d["Regular_Game"],
                regularSeasonTotal: +d["Regular_Total"],
                // combined
                combinedPractice: +d["Combined_Practice"],
                combinedGame: +d["Combined_Game"], 
                combinedTotal: +d["Combined_Total"]
            };
        });
        
        return processedData;
    } catch (error) {
        console.error("error loading csv data:", error);
        return [];
    }
}

// ===== TUTORIAL STATE =====
let tutorialStep = 0;
let scenesCompleted = [false, false, false]; // track which scenes have been viewed
let tutorialActive = true;
let allowedScenes = [true, false, false]; // shich scenes user can access

const tutorialSteps = [
    { text: "You can navigate the scenes at the top of the page", target: "#navigation" },
    { text: "You can control the parameters where it says 'Display Data'", target: "#controls" },
    { text: "Steps the NFL has taken to reduce concussions can be found right of the chart", target: ".annotation-box" },
    { text: "Showing scene 1 for 2015-2018. Click the scene 2 button to go to the next scene.", target: "#navigation" },
    { text: "Showing scene 2 for 2015-2021. Click the scene 3 button to go to the next scene.", target: "#navigation" },
    { text: "You have viewed all of the scenes, feel free to explore with the Display Data dropdown filter.", target: "#navigation" }
];

// ===== PARAMETERS =====
let currentScene = 1;
let selectedCategory = 'combined';
let showPreseason = true;
let showRegularSeason = true;
let chartWidth = 800;
let chartHeight = 400;

// ===== ANNOTATIONS DATA =====
const annotations = 
{
    scene1: [
        {year: 2015, text: "NFL owners approve a new rule allowing independent concussion spotters the authority to contact game officials directly and halt play", type: "rule"},
        {year: 2015, text: "NFL introduces a yearly helmet performance ranking system with 'Top-Performing', 'Performing', and 'Not Recommended' categories"},
        {year: 2016, text: "NFL teams now face fines, loss of draft picks if they violate concussion protocol", type: "protocol"},
        {year: 2017, text: "Guardian wins the first NFL HeadHealthTECH challenge", type: "helmet"} // After 5 years on the field with major college programs, Guardian wins contract to “develop new and improved helmet and protective equipment over the next three to five years.”
    ],
    scene2: [
        {year: 2019, text: "NFL & NFLPA engineers reveal Guardian Caps make a statistically significant improvement over hard-shelled helmets alone", type: "helmet"},
        {year: 2020, text: "NFL sends out a memo permitting Guardian Caps", type: "helmet"},
        {year: 2020, text: "99% of players are wearing top-performing helmets", type: "helmet"},
        {year: 2021, text: "NFL begins developing position-specific helmets designed on impacts typically received", type: "helmet"}
    ],
    scene3: [
        {year: 2022, text: "NFL Owners voted to mandate Guardian Caps through the second preseason game for OL/DL/LB/TE", type: "rule"}, // according to NFL-NFLPA engineers, addition of Guardian Cap represents a 20% reduction in head impact severity if two players are wearing them
        // after 2022 season, reported that concussions among the players who wore the Guardian Caps dropped more than 50%
        {year: 2023, text: "NFL expands rule against misuse of helmet - penalty and potential disqualification if forcible contact made to opponent's head or neck area", type: "rule"},
        {year: 2023, text: "Expanded use of mandated Guardian Caps", type: "rule"}, // changes include use in all preseason, regular season and post season practices instead of just preseason.  Players at position groups with most head contact will be required to wear Caps; this adds RB/FB
        {year: 2024, text: "NFL allows Guardian Caps to be worn in games", type: "rule"},
        {year: 2024, text: "Tweleve new helmet models are eligible for players to wear, five test better than any helmet ever worn the in the league", type: "helmet"},
        {year: 2024, text: "New Dynamic Kickoff format - reduced player speeds by approximately 20% and injury rates by 32% in the preseason", type: "rule"}
    ]
};

function getCategoryDisplayName(category) 
{
    switch(category) {
        case 'combined': return 'Combined';
        case 'preseason': return 'Preseason';
        case 'regularSeason': return 'Regular Season';
        default: return 'Unknown';
    }
}

function getAnnotationColor(type) 
{
    switch(type) {
        case 'helmet':
            return '#ffa600'; // helmet updates
        case 'protocol':
            return '#2f4b7c'; // protocol changes
        case 'rule':
            return '#665191'; // rule changes
        default:
            return '#17d721ff'; // otherwise
    }
}

function animateLine(path, delay = 0) 
{
    const totalLength = path.node().getTotalLength();
    
    path
        .attr('stroke-dasharray', totalLength + ' ' + totalLength)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .delay(delay)
        .duration(3000) 
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', 0);
}

function createChart(data, sceneAnnotations, category) 
{
    d3.select('#chart').selectAll('*').remove();

    d3.select("body").selectAll(".tooltip").remove();

    let tooltip = d3.select("body").select(".tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("padding", "6px 10px")
            .style("border-radius", "4px")
            .style("pointer-events", "none")
            .style("font-size", "12px")
            .style("opacity", 0);
    }

    const margin = {top: 40, right: 160, bottom: 50, left: 60};
    const width = 1000 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select('#chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right + 400)
        .attr('height', height + margin.top + margin.bottom + 140)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    if (category === 'combined') {
        practiceField = 'combinedPractice';
        gameField = 'combinedGame';
        totalField = 'combinedTotal';
    } else if (category === 'preseason') {
        practiceField = 'preseasonPractice';
        gameField = 'preseasonGame';
        totalField = 'preseasonTotal';
    } else if (category === 'regularSeason') {
        practiceField = 'regularSeasonPractice';
        gameField = 'regularSeasonGame';
        totalField = 'regularSeasonTotal';
    }

    // scales
    const xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.year))
        .range([0, width]);

    const yMax = d3.max(data, d => Math.max(d[practiceField], d[gameField], d[totalField]));
    const yScale = d3.scaleLinear()
        .domain([0, yMax + 20]) 
        .range([height, 0]);

    // horizontal grid lines
    svg.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(yScale)
            .ticks(8)
            .tickSize(-width)
            .tickFormat('')
        )
        .style('stroke-dasharray', '3,3')
        .style('opacity', 0.3);

    // vertical grid lines
    svg.append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale)
            .ticks(data.length)
            .tickSize(-height)
            .tickFormat('')
        )
        .style('stroke-dasharray', '3,3')
        .style('opacity', 0.3);

    // axes
    const xAxis = d3.axisBottom(xScale)
        .ticks(data.length)
        .tickFormat(d3.format('d'))
        .tickSize(6)
        .tickPadding(8);

    const yAxis = d3.axisLeft(yScale)
        .ticks(8)
        .tickSize(6)
        .tickPadding(8);

    // x axis
    svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis)
        .style('font-size', '12px');

    // y axis
    svg.append('g')
        .attr('class', 'y-axis')
        .call(yAxis)
        .style('font-size', '12px');

    // style axis lines
    svg.selectAll('.x-axis path, .y-axis path')
        .style('stroke', '#000')
        .style('stroke-width', 1);

    svg.selectAll('.x-axis .tick line, .y-axis .tick line')
        .style('stroke', '#000')
        .style('stroke-width', 1);

    // axis labels
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 10)
        .style('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text('Year');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -margin.left + 20)
        .style('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text('Number of Concussions');

    // line generators
    const linePractice = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d[practiceField]))
        .curve(d3.curveMonotoneX);

    const lineGame = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d[gameField]))
        .curve(d3.curveMonotoneX);

    const lineTotal = d3.line()
        .x(d => xScale(d.year))
        .y(d => yScale(d[totalField]))
        .curve(d3.curveMonotoneX);

    // draw lines
    const practicePath = svg.append('path')
        .datum(data)
        .attr('class', 'practice-line')
        .attr('fill', 'none')
        .attr('stroke', '#ff6b6b')
        .attr('stroke-width', 3)
        .attr('stroke-linecap', 'round')
        .attr('d', linePractice)

    const gamePath = svg.append('path')
        .datum(data)
        .attr('class', 'game-line')
        .attr('fill', 'none')
        .attr('stroke', '#4ecdc4')
        .attr('stroke-width', 3)
        .attr('stroke-linecap', 'round')
        .attr('d', lineGame);

    const totalPath = svg.append('path')
        .datum(data)
        .attr('class', 'total-line')
        .attr('fill', 'none')
        .attr('stroke', '#556270') 
        .attr('stroke-width', 3)
        .attr('stroke-linecap', 'round')
        .attr('d', lineTotal);

    animateLine(practicePath, 0);
    animateLine(gamePath, 0);
    animateLine(totalPath, 0);

    // add data points
    svg.selectAll('.practice-dots')
    .data(data)
    .enter().append('circle')
    .attr('class', 'practice-dots')
    .attr('cx', d => xScale(d.year))
    .attr('cy', d => yScale(d[practiceField]))
    .attr('r', 4)
    .attr('fill', '#ff6b6b')
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('mouseover', function(d, i) {
        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(
            `<strong>Category:</strong> Practice<br>` +
            `<strong>Year:</strong> ${d.year}<br>` +
            `<strong>Concussions:</strong> ${d[practiceField]}`
        )
            .style('left', (d3.event.pageX + 15) + 'px')
            .style('top', (d3.event.pageY - 25) + 'px');
    })
    .on('mouseout', function() {
        tooltip.transition().duration(150).style('opacity', 0);
    });

svg.selectAll('.game-dots')
    .data(data)
    .enter().append('circle')
    .attr('class', 'game-dots')
    .attr('cx', d => xScale(d.year))
    .attr('cy', d => yScale(d[gameField]))
    .attr('r', 4)
    .attr('fill', '#4ecdc4')
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    svg.selectAll('.game-dots')
    .on('mouseover', function(d, i) {
        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(
            `<strong>Category:</strong> Game<br>` +
            `<strong>Year:</strong> ${d.year}<br>` +
            `<strong>Concussions:</strong> ${d[gameField]}`
        )
            .style('left', (d3.event.pageX + 15) + 'px')
            .style('top', (d3.event.pageY - 25) + 'px');
    })
    .on('mouseout', function() {
        tooltip.transition().duration(150).style('opacity', 0);
    });

svg.selectAll('.total-dots')
    .data(data)
    .enter().append('circle')
    .attr('class', 'total-dots')
    .attr('cx', d => xScale(d.year))
    .attr('cy', d => yScale(d[totalField]))
    .attr('r', 4)
    .attr('fill', '#556270')
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .style('cursor', 'pointer')
    .on('mouseover', function(d, i) {
        console.log("event:", event);
        console.log("d:", d);
        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(
            `<strong>Category:</strong> Total<br>` +
            `<strong>Year:</strong> ${d.year}<br>` +
            `<strong>Concussions:</strong> ${d[totalField]}`
        )
            .style('left', (d3.event.pageX + 15) + 'px')
            .style('top', (d3.event.pageY - 25) + 'px');
    })
    .on('mouseout', function() {
        tooltip.transition().duration(150).style('opacity', 0);
    });

    // add legend
    const legendData = [
        {label: 'Practice', color: '#ff6b6b'},
        {label: 'Games', color: '#4ecdc4'},
        {label: 'Total', color: '#556270'}
    ];

    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width + 20}, 20)`);

    legend.selectAll('rect')
        .data(legendData)
        .enter()
        .append('rect')
        .attr('x', 0)
        .attr('y', (d, i) => i * 25)
        .attr('width', 20)
        .attr('height', 18)
        .attr('fill', d => d.color)
        .attr('rx', 2);

    legend.selectAll('text')
        .data(legendData)
        .enter()
        .append('text')
        .attr('x', 30)
        .attr('y', (d, i) => i * 25 + 14)
        .text(d => d.label)
        .style('font-size', '12px')
        .style('fill', '#333')
        .style('font-weight', '500');

    // add category indicator
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -20)
        .style('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .style('fill', '#333')
        .text(`${category.charAt(0).toUpperCase() + category.slice(1)} Concussions`);

    addAnnotations(svg, sceneAnnotations, xScale, yScale, height, width);
}

function wrapTextToLines(text, maxWidth) 
{
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    const avgCharWidth = 7;

    words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const estimatedWidth = testLine.length * avgCharWidth;
        
        if (estimatedWidth <= maxWidth) {
            currentLine = testLine;
        } else {
            if (currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                lines.push(word);
                currentLine = '';
            }
        }
    });
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}

function getTextWidth(text, font) 
{
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = font;
    return context.measureText(text).width;
}

function addAnnotations(svg, annotations, xScale, yScale, height, width) 
{
    // group annotations by year
    const annotationsByYear = {};
    annotations.forEach(annotation => {
        if (!annotationsByYear[annotation.year]) {
            annotationsByYear[annotation.year] = [];
        }
        annotationsByYear[annotation.year].push(annotation);
    });

    // sort years
    const years = Object.keys(annotationsByYear).sort((a, b) => a - b);
    
    const yearColors = [
        '#e74c3c', 
        '#3498db', 
        '#2ecc71', 
        '#f39c12', 
        '#9b59b6', 
        '#1abc9c', 
        '#e67e22', 
        '#34495e'  
    ];
    
    // add vertical lines for each year with distinct colors
    years.forEach((year, index) => {
        const x = xScale(+year);
        const yearColor = yearColors[index % yearColors.length];
        
        // create vertical dashed line
        svg.append('line')
            .attr('class', 'annotation-line')
            .attr('x1', x)
            .attr('y1', -30)
            .attr('x2', x)
            .attr('y2', height)
            .attr('stroke', yearColor)
            .attr('stroke-width', 3)
            .attr('stroke-dasharray', '5,5')
            .attr('opacity', 0.8);

        svg.append('circle')
            .attr('cx', x)
            .attr('cy', -20)
            .attr('r', 5)
            .attr('fill', yearColor)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
    });

    createAnnotationBoxes(svg, annotationsByYear, width, years, yearColors);
}

function createAnnotationBoxes(svg, annotationsByYear, chartWidth, years, yearColors) 
{
    const boxStartX = chartWidth + 180;
    const boxWidth = 300;
    const boxSpacing = 20;
    let currentY = 0;

    years.forEach((year, yearIndex) => {
        const yearAnnotations = annotationsByYear[year];
        const yearColor = yearColors[yearIndex % yearColors.length];
        
        // cakc proper box height based on wrapped text content
        const titleHeight = 25;
        const lineHeight = 16;
        const padding = 12;
        const bulletSpacing = 8;
        
        // calc total lines needed for all annotations
        let totalLines = 0;
        const wrappedAnnotations = yearAnnotations.map(annotation => {
            const lines = wrapTextToLines(annotation.text, boxWidth - 30);
            totalLines += lines.length;
            return { ...annotation, lines };
        });
        
        const extraSpacing = (yearAnnotations.length - 1) * bulletSpacing;
        const boxHeight = titleHeight + padding + (totalLines * lineHeight) + extraSpacing + padding;

        const boxGroup = svg.append('g')
            .attr('class', 'annotation-box')
            .attr('transform', `translate(${boxStartX}, ${currentY})`);

        boxGroup.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', boxWidth)
            .attr('height', boxHeight)
            .attr('fill', '#f8f9fa')
            .attr('stroke', '#dee2e6')
            .attr('stroke-width', 1)
            .attr('rx', 6);

        // add year title
        boxGroup.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', boxWidth)
            .attr('height', titleHeight)
            .attr('fill', yearColor)
            .attr('rx', 6);

        boxGroup.append('rect')
            .attr('x', 0)
            .attr('y', 12)
            .attr('width', boxWidth)
            .attr('height', 13)
            .attr('fill', yearColor);

        // add year text
        boxGroup.append('text')
            .attr('x', padding)
            .attr('y', 18)
            .text(year)
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', '#fff');

        // add annotation texts with proper spacing
        let currentTextY = titleHeight + padding;
        
        wrappedAnnotations.forEach((annotation, annotationIndex) => {
            // add colored type indicator at the start of each bullet point
            const typeColor = getAnnotationColor(annotation.type);
            boxGroup.append('circle')
                .attr('cx', padding + 6)
                .attr('cy', currentTextY + 8) // position at first line of text
                .attr('r', 3)
                .attr('fill', typeColor);

            // add each line of wrapped text
            annotation.lines.forEach((line, lineIndex) => {
                boxGroup.append('text')
                    .attr('x', padding + 18)
                    .attr('y', currentTextY + 12 + (lineIndex * lineHeight))
                    .text(line)
                    .style('font-size', '12px')
                    .style('fill', '#333')
                    .style('font-family', 'Arial, sans-serif');
            });

            // move Y position for next annotation
            currentTextY += (annotation.lines.length * lineHeight) + bulletSpacing;
        });

        // update Y position for next box
        currentY += boxHeight + boxSpacing;
    });
}

// ===== TUTORIAL FUNCTIONS =====
function showTutorialStep(step) {
    const overlay = d3.select('#tutorial-overlay');
    const text = d3.select('#tutorial-text');
    
    if (step < tutorialSteps.length) {
        text.text(tutorialSteps[step].text);
        overlay.style('display', 'flex');
    }
}

function closeTutorialStep() {
    d3.select('#tutorial-overlay').style('display', 'none');
    tutorialStep++;
    
    switch(tutorialStep) {
        case 1:
            // after navigation explanation, show controls
            showTutorialStep(1);
            break;
        case 2:
            setTimeout(() => showTutorialStep(2), 1000);
            break;
        case 3:
            // hide controls dropdown
            d3.select('#controls').classed('hidden', true);
            updateButtonStates();
            showTutorialStep(3);
            break;
        case 4:
            // allow scene 2, show scene 2 message when clicked
            allowedScenes[1] = true;
            updateButtonStates();
            break;
        case 5:
            // allow scene 3
            allowedScenes[2] = true;
            updateButtonStates();
            break;
        case 6:
            // tutorial complete, show controls again
            d3.select('#controls').classed('hidden', false);
            tutorialActive = false;
            break;
    }
}

function updateButtonStates() {
    const buttons = ['#scene1-btn', '#scene2-btn', '#scene3-btn'];
    
    buttons.forEach((buttonId, index) => {
        const button = d3.select(buttonId);
        
        // remove all state classes
        button.classed('completed available unavailable current', false);
        
        if (scenesCompleted[index]) {
            button.classed('completed', true);
        } else if (allowedScenes[index]) {
            if (currentScene === index + 1) {
                button.classed('current', true);
            } else {
                button.classed('available', true);
            }
        } else {
            button.classed('unavailable', true);
        }
    });
}

function checkAllScenesViewed() {
    return scenesCompleted.every(completed => completed);
}

// ===== SCENE FUNCTIONS =====
function showScene1() 
{
    if (tutorialActive && !allowedScenes[0]) return;
    
    const scene1Data = concussionData.filter(d => d.year >= 2015 && d.year <= 2018);
    clearChart();
    createChart(scene1Data, annotations.scene1, selectedCategory);
    updateNavigation(1);
    scenesCompleted[0] = true;
    updateButtonStates();
}

function showScene2() 
{
    if (tutorialActive && !allowedScenes[1]) return;
    
    const scene2Data = concussionData.filter(d => d.year >= 2015 && d.year <= 2021);
    clearChart();
    createChart(scene2Data, annotations.scene2, selectedCategory);
    updateNavigation(2);
    scenesCompleted[1] = true;
    updateButtonStates();
    
    // show next tutorial step if in tutorial mode
    if (tutorialActive && tutorialStep === 4) {
        setTimeout(() => showTutorialStep(4), 1000);
    }
}

function showScene3() 
{
    if (tutorialActive && !allowedScenes[2]) return;
    
    const scene3Data = concussionData.filter(d => d.year >= 2015 && d.year <= 2024);
    clearChart();
    createChart(scene3Data, annotations.scene3, selectedCategory);
    updateNavigation(3);
    scenesCompleted[2] = true;
    updateButtonStates();
    
    // check if all scenes completed
    if (checkAllScenesViewed() && tutorialActive && tutorialStep === 5) {
        setTimeout(() => showTutorialStep(5), 1000);
    }
}

function showExploreMode() 
{
    if (tutorialActive) return; // don't allow explore mode during tutorial
    
    clearChart();
    createChart(concussionData, [], selectedCategory);
    updateNavigation(4);
}

// ===== TRIGGERS =====
function setupTriggers() 
{
    // tutorial close button
    d3.select("#tutorial-close").on("click", closeTutorialStep);
    
    // navigation buttons
    d3.select("#scene1-btn").on("click", showScene1);
    d3.select("#scene2-btn").on("click", showScene2);
    d3.select("#scene3-btn").on("click", showScene3);
    d3.select("#explore-btn").on("click", showExploreMode);
    
    // dropdown change event (only when not in tutorial mode)
    d3.select("#dataTypeSelect").on("change", function() {
        if (tutorialActive) return;
        
        selectedCategory = this.value;
        
        // redraw current scene with new category
        switch(currentScene) {
            case 1:
                showScene1();
                break;
            case 2:
                showScene2();
                break;
            case 3:
                showScene3();
                break;
            case 4:
                showExploreMode();
                break;
        }
    });
}

// ===== UTILITY FUNCTIONS =====
function clearChart() 
{
    d3.select("#chart").selectAll("*").remove();
}

function updateNavigation(activeScene) 
{
    // update current scene tracker
    currentScene = activeScene;
    
    // remove active class from all buttons
    d3.selectAll('#navigation button').classed('active', false);
    
    // add active class to current scene button
    const buttonIds = ['#scene1-btn', '#scene2-btn', '#scene3-btn'];
    if (activeScene >= 1 && activeScene <= 4) {
        d3.select(buttonIds[activeScene - 1]).classed('active', true);
    }
}

// ===== INITIALIZATION =====
async function init() 
{
    concussionData = await loadConcussionData();

    if (concussionData.length === 0)
    {
        console.error("failed to load data");
        return;
    }

    // set drop down to default value
    d3.select("#dataTypeSelect").property("value", selectedCategory);

    // set up visualization
    setupTriggers();
    showScene1();

    // start tutorial after chart loads
    setTimeout(() => {
        showTutorialStep(0);
    }, 1500);
}

// start when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
