
removeDups = function(arr) {
	return arr.filter((n, idx)=>arr.indexOf(n) === idx);
}

var genDiagramTPA = (function() {
	var opToFunctionMap = {
		'subtraction': 'setSubtractionDiagrams',
		'division-simple': 'setDivisionDiagrams',
		'division-complex': 'setDivisionDiagrams'
	};
	return function (transformationList) {
		console.log("genDiagramTPA for ")
		var transformation = transformationList[0]; //only cover one right now
		console.log(transformation);
		var functionName = opToFunctionMap[transformation.operation],
			simpSides = transformation.expAfter.split("=").map((side)=>CTATAlgebraParser.theParser.algSimplify(side)),
			argStr = simpSides.concat(transformation.operand).join(",");
		console.log(functionName);
		return ['_root', functionName, argStr];
	}
})();

function unknownTermStr(t, fillInCouldBe) {
	return fillInCouldBe ? simpleTermStr(t.couldBe) : "?";
}

function checkEqualEquation(input1, input2){
	const ret = CTATAlgebraParser.theParser.algIdentical(input1, input2, false, false);
	return ret; 
}

/*check if two strings are the same expression
*/
function SAIeq(sai1, sai2) {
//	console.log("+++saiEqual", sai1, sai2);
	if ( (sai1.selection === sai2.selection)
			&& (sai1.action === sai2.action)
			&& checkEqualEquation(sai1.input, sai2.input) ) {
		return true;
	}
	else {
		return false;
	}
}

/*
return the opposite side of side
*/
function oppositeSide(side) {
//	console.log("oppositeSide", side);
	return side === "left" ? "right" : "left"; 
}

/*
set fact number
*/
var curFactNr  = 0;
function setFactNr(f) {
	f.factNr = curFactNr++;
}

var possibleInputs = {
	"left": {},
	"right": {},
	"full": {},
	"full-abstract": {},
	"full-detailed": {}
};
var writeInputs = [];

function clearInputHistory(key) {
	if (key) {
		possibleInputs[key] = {};
	} else {
		possibleInputs = {
			"left": {},
			"right": {},
			"full": {},
			"full-abstract": {},
			"full-detailed": {}
		};
	}
	writeInputs = [];
}

function inputRepeated(input, side){
	let ret = possibleInputs[side][input];
	return ret;
}

function recordInput(input, side){
	possibleInputs[side][input] = true;
}

function writeInput(input){
	writeInputs.push(input);
}

function finishedLastTransformation(){
	var transformations = getFacts("transformation");
	return ( transformations.length <= 1);
}

//ret type of interface being used.  Either "dragndrop", "typein", or "diagrams"
function getInterfaceType() {
	return window.interfaceType;
}

//diagram-first functions
var _validSteps = [];
function clearValidSteps() {
	_validSteps = [];
}

function addValidStep(operation, operand, expBefore, expAfter, hints, skills) {
	console.log("add valid step: ",arguments);
	_validSteps.push({"operation": operation, "operand": operand, "expBefore": expBefore, "expAfter": expAfter, "hints": hints, "skills": skills});
}

function stringifyValidSteps() {
	var str = _validSteps.map((step)=>{ return step.expBefore+','+step.operation+','+step.operand }).join('|');
	return str;
}

function getValidStepHintsAndSkills() {
	//for now just return first one.
	let step = _validSteps[0] ? _validSteps[0] : {hints: [], skills: []};
	return [{hints: step.hints, skills: step.skills}];
}