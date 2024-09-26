(function() {
	function isOneTimesVar(factor1, factor2) {
		return (factor1.operator === "VAR" && factor2.operator === "CONST" && Math.abs(factor2.value) === 1)
			|| (factor2.operator === "VAR" && factor1.operator === "CONST" && Math.abs(factor1.value) === 1); 
	}

	function MathUtil() {
		
		var opPrecedence = {
			"CONST": 6,
			"VAR": 6,
			"UMINUS": 5,
			"UPLUS": 5,
			"EXP": 4,
			"ROOT": 4,
			"TIMES": 3,
			"DIVIDE": 3,
			"PLUS": 2,
			"MINUS": 2
		};
		
		var ctap = new CTATAlgebraParser();
		
		this.getReciprocal = function(n) {
			return ctap.algSimplify(n+"^-1");
		}
		
		this.joinSides = function(s1, s2, sort) {
			let str1 = s1.tree.toString(),
				str2 = s2.tree.toString();
			return sort ? (str1 < str2 ? str1+' = '+str2 : str2+' = '+str1) : (s1.side === "left" ? str1+' = '+str2 : str2+' = '+str1);
		}
		/**
			Exp scanning functions
		**/
		this.scanUminusNode = function (node, pNode, childIdx, cOps, vOps, cPairs, multipliable, dividable, distributable) {
			var res = {hasVar: false, varName: null, hasConst: false, operation: null, coeff: null};
			switch(node.base.operator) {
				case "CONST":
					res.hasConst = true;
					res.termType = 'const';
					res.factors = this.getFactors(node.evaluate());
					res.operation = 'simple';
					break;
				case "VAR":
					res.hasVar = true;
					res.termType = 'var';
					res.factors = [];
					res.operation = 'simple';
					res.coeff = -1;
                    res.varName = node.base.variable;
					break;
				default:
					throw new Error("unsupported expression form 5 (bad UMINUS)");
					break;
			}
			return res;
		};

		this.scanTimesNode = function (node, pNode, childIdx, cOps, vOps, cPairs, multipliable, dividable, distributable) {
			let allConst = true;
			let isFrac = false;
			let res = {hasVar: false, termType: null, operation: null, coeff: null, factors: [], multipliable: [], dividable: [], varName: null};
			let variable = null, coeff = null, varName;
			let plusNode = null;
			let denominator = null;
			let simpleFactors = []
			newNode = ctap.algApplyRules(node, ['flatten']);
			if (pNode) {
				pNode.terms.splice(childIdx, 1, newNode);
			}
			node = newNode;
			//scan each factor
			node.factors.forEach((factor, factorIdx)=>{ //per factor
				let scanFunc, isSimple, termType;
				let factorExp = typeof factor.exp === "object" ? factor.exp.evaluate() : factor.exp;
				let factorStr = factor.toString();
				switch(factor.operator) {
					case "VAR":
						allConst = false;
						if (node.factors.length === 2) {
							variable = factorStr;
                            varName = factor.variable;
						}
						termType = 'var';
						isSimple = true;
						break;
					case "CONST": 
						if (factorExp > 0 && factor.value < 1 && factor.value !== 0) {
							//treat as fraction
							factor.value = 1/factor.value;
							factorExp = (factor.exp = -1 * factorExp);
						}
						res.factors = res.factors.concat(this.getFactors(node.sign*factor.evaluate()));
						termType = 'const';
						isSimple = true;
						break;
					case "UPLUS":
					case "UMINUS":
						scanFunc = this.scanUminusNode.bind(this, factor, node, factorIdx, cOps, vOps, cPairs, multipliable, dividable, distributable);
						break;
					case "PLUS":
						scanFunc = this.scanPlusNode.bind(this, factor, node, factorIdx, cOps, vOps, cPairs, multipliable, dividable, distributable);
						plusNode = factor;
						break;
					case "TIMES": //shouldn't happen
						let tRes = this.scanTimesNode(factor, node, factorIdx, cOps, vOps, cPairs, multipliable, dividable, distributable);
						if (tRes.operation.includes('divide')) {
							isFrac = true;
						} else {
							res.factors = res.factors.concat(tRes.factors);
						}
						allConst = (tRes.termType !== "var");
					default:
						throw new Error("unsupported expression form 1 ("+factor.operator+" in TIMES node)");
				}
				if (scanFunc) {
					let scanRes = scanFunc();
					res.factors = res.factors.concat(scanRes.factors);
					allConst = allConst && !scanRes.hasVar;
					termType = scanRes.termType;
					isSimple = scanRes.operation === 'simple';
					if (plusNode === factor) {
						plusNode = scanRes;
						plusNode.node = factor;
					}
                    varName = varName || scanRes.varName
				}
				if (termType === "const" && node.factors.length === 2) {
					coeff = node.sign * factor.evaluate();
				}
				if (factorExp < 0) {
					isFrac = true;
					if (isSimple) {
						denominator = this.getReciprocal(factor);
					}
				}
				
				if(isSimple) {

					//for every pair of simple factors...
					for (let otherIdx = 0; otherIdx < simpleFactors.length; otherIdx++) {
						let otherSf = simpleFactors[otherIdx];
						let otherSfExp = typeof otherSf.exp === "object" ? otherSf.exp.evaluate() : otherSf.exp;

						if (factorExp === otherSfExp) {
							if (!isNaN(factorStr) && !isNaN(otherSf.toString())
								|| isOneTimesVar(factor, otherSf)
							) {
								multipliable.push({
									timesNode: node,
									parent: pNode,
									childIdx: childIdx,
									coeff: coeff || 1,
									factors: [factor, otherSf]
								});
							}
						} else {
							let numer = factorExp < 0 ? otherSf : factor,
								denom = factorExp < 0 ? factor : otherSf,
								denomStr = ctap.algSimplify(denom.toString()+'^-1');
                            if ((Math.abs(denomStr) === 1) || (numer.evaluate()%(+denomStr) === 0)) {
								dividable.push({
									timesNode: node,
									parent: pNode,
									childIdx: childIdx,
									coeff: coeff || 1,
									numer: numer,
									denom: denom
								});
							}
						}
					}
					simpleFactors.push(factor);
				}
			});
			
			let opject = {term: node, parent: pNode, childIdx: childIdx, coeff: coeff || 1};
			
			if (variable && coeff && !isFrac) {
				opject.operation = "simple";
				res.coeff = coeff;
			} else if (plusNode && node.factors.length === 2) {
				opject.operation = isFrac ? "dist-divide" : "dist-times";
				opject.plusNode = plusNode;
				let other = node.factors.find((f)=>f !== plusNode.node);
				opject.toDistribute = other;
				if (!isFrac || this.divisibleBy(plusNode.factors, denominator)) {
					distributable.push(opject);
				}
				if (plusNode.hasConst && !isNaN(ctap.algEvaluate(other).toString())) {
					res.hasConst = true;
				}
			} else {
				opject.operation = isFrac ? "divide" : "times";
			}
			
			if (allConst) {
				res.termType = 'const';
			} else {
				res.termType = 'var';
                res.hasVar = true;
			}
			isFrac && (res.factors = []);
			res.operation = opject.operation;
			res.denominator = denominator;
            res.varName = varName;
			return res;
		};

		this.scanPlusNode = function (plusNode, pNode, childIdx, cOps, vOps, cPairs, multipliable, dividable, distributable) {
			var pNodeStr = plusNode.toString();
			var res = {hasVar: false, varName: null, hasConst: false, factors: [], operation: "plus"};
			plusNode.terms.forEach((term, termIdx)=> {
				let termType, termFactors = [], operation, coeff = 1;
				let scanFunc, childPlus;
				switch(term.operator) {
					case "VAR":
						operation = 'simple';
						termType = 'var';
                        res.varName = term.variable;
						coeff = term.sign;
						termFactors = [1];
						break;
					case "CONST":
						operation = 'simple';
						termType = 'const';
						termFactors = this.getFactors(term.evaluate());
						break;
					case "TIMES":
						scanFunc = 'scanTimesNode';
						break;
					case "UMINUS":
						scanFunc = 'scanUminusNode';
						break;
					case "PLUS":
						if (term.sign === -1) {//special case of distribution
							scanFunc = 'scanPlusNode';
							childPlus = term;
							break;
						} //otherwise error on nested pluses
					default:
						console.log("bad term: ",term);
						console.log("	 (str): ",term.toString()); 
						console.log("full node: ",plusNode);
						console.log("	 (str): ",plusNode.toString());
						throw new Error("unsupported expression form 2; operator "+term.operator);
				}
				
				//scan if not simple term
				let scanRes; 
				if (scanFunc) {
					scanRes = this[scanFunc](term, plusNode, termIdx, cOps, vOps, cPairs, multipliable, dividable, distributable);
					termFactors = scanRes.factors;
					termType = scanRes.termType;
					coeff = scanRes.coeff;
					operation = scanRes.operation;
                    res.varName = res.varName || scanRes.varName;
					if (childPlus === term) {
						childPlus = scanRes;
						childPlus.node = term;
					}
				}
				
				//add to operand/combinablePairs lists
				let opject = {term: term, parent: plusNode, childIdx: termIdx, coeff: coeff, isSimple: operation === "simple"};
				let opList;
				if (operation === "plus") {
					//must be negated plus node, add to distributable
					//console.log("add negated plus to distributable");
					opject.operation = "dist-times";
					opject.plusNode = childPlus;
					opject.toDistribute = "-1";
					distributable.push(opject);
					if (childPlus.hasConst) {
						res.hasConst = true;
					}
				} else {
				
					switch(termType) {
						case 'var':
							res.hasVar = true;
							opList = vOps;
							break;
						case 'const':
							res.hasConst = true;
							opList = cOps
							break;
						default: 
							throw new Error("unsupported term type: "+termType);
							break;
					}
					if (opject.isSimple) {
						opList.forEach((op)=>{
							if (op.isSimple && plusNode === op.parent) {
								cPairs.push({t1: op, t2: opject, cancelable: this.areCancelable(op, opject)}); 
							}
						});
					}
					opList.push(opject);
				}
				//update factors list 
				if (termIdx === 0) {
					res.factors = termFactors;
				} else {
					res.factors = res.factors.filter((f)=>termFactors.indexOf(f) >= 0);
				}
			});
			return res;
		};

		this.scanExpression = function (exp) {
			var res = {
				constOperands: [],
				varOperands: [],
                varName: null,
				combinablePairs: [],
				factors: [],
				hasConst: false,
				hasVar: false,
				multipliable: [],
				dividable: [],
				distributable: [],
				operation: null
			};
			var varParentMap = {};
			var constParentMap = {};
			var expStr = exp.toString();
			let isSimple = false, coeff = null, type = null;
			let scanFunc;
			switch(exp.operator) {
				case "VAR":
					isSimple = true;
					coeff = exp.sign;
					type = "var";
					res.factors = [1];
                    res.varName = exp.variable;
					break;
				case "CONST":
					isSimple = true;
					coeff = 1;
					type = "const";
					res.factors = this.getFactors(exp.evaluate());
					break;
				case "PLUS":
					scanFunc = 'scanPlusNode';
					break;
				case "TIMES":
					scanFunc = 'scanTimesNode';
					break;
				case "UMINUS":
					scanFunc = 'scanUminusNode';
					break;
				default:
					console.log("unsupported expression form 3 for exp: ",exp);
					throw new Error("unsupported expression form 3 for exp: ",exp);
			}
			let scanRes;
			if (scanFunc) {
				scanRes = this[scanFunc](exp, null, null, res.constOperands, res.varOperands, res.combinablePairs, res.multipliable, res.dividable, res.distributable);
				res.hasVar = scanRes.hasVar;
				res.hasConst = scanRes.hasConst;
				res.factors = scanRes.factors;
				isSimple = (scanRes.operation === "simple");
				coeff = scanRes.coeff || 1;
				type = scanRes.termType;
				res.operation = scanRes.operation;
				res.denominator = scanRes.denominator;
                if (scanRes.hasVar) {
                    res.varName = scanRes.varName;
                }
			}
			let opList;
			if (type === "var") {
				opList = res.varOperands;			
				res.hasVar = true;
			} else if (type === "const") {
				opList = res.constOperands;
				res.hasConst = true;
			} else if (scanRes.operation === "plus" && exp.sign === -1) {
				//negated plus node, add to distributable
				scanRes.node = exp;
				res.distributable.push({
					term: exp,
					parent: null,
					coeff: coeff,
					isSimple: false,
					operation: 'dist-times',
					plusNode: scanRes,
					toDistribute: "-1"
				});
			}
			if (isSimple) {
				opList.push({term: exp, parent: null, coeff: coeff, isSimple: true});
				res.isSimple = true;
				res.operation = "simple";
			}
			return res;
		};
		
		this.getPrecedence = function(operator) {
			return opPrecedence[operator];
		};
		
		this.hasCancelable = function(scannedTreeExp, optParent) {
			let pairs = scannedTreeExp.eqData.combinablePairs;
			for (let i = 0; i < pairs.length; i++) {
				if (pairs[i].cancelable) {
					if (!optParent || pairs[i].t1.parent === optParent) {
						return true;
					}
				}
			}
			return false;
		}
		
		this.isCancelable = function(t, scannedTreeExp) {
			let tStr = t.term.toString();
			let likeTerms = isNaN(CTATAlgebraParser.theParser.algSimplify(tStr)) ? scannedTreeExp.eqData.varOperands : scannedTreeExp.eqData.constOperands;
			let term = likeTerms.find((lt)=> lt.term.toString() === tStr);
			if (term) {
				for (let i = 0; i < likeTerms.length; i++) {
					if (this.areCancelable(term, likeTerms[i])) {
						return true;
					}
				}
			}
			return false;
		}
		
		this.areCancelable = function (t1, t2) {
			return t1.parent === t2.parent && ctap.algIdentical(ctap.algSimplify(t1.term.toString()+'*-1').toString(), t2.term.toString());	
		};

		this.getCancelTerm = function (termObject) {
			let cancelTerm = null;
			if (termObject.parent) {
				let parent = termObject.parent;
				for (let i = 0; i < parent.terms.length; i++) {
					let sibling = parent.terms[i];
					if (ctap.algIdentical(ctap.algSimplify(sibling.toString()+'*-1'), termObject.term.toString())) {
						cancelTerm = sibling;
						break;
					}
				}
			}
			return cancelTerm;
		};

		this.getCancelableTerms = function (exp) {
			var termPairs = [];
			var termMap = {};
			
			[exp.eqData.varOperands, exp.eqData.constOperands].forEach((operands) => {
				operands.forEach((op) => {
					let cancelOp;
					let opStr = op.term.toString();
					if (cancelOp = termMap[ctap.algSimplify(opStr+'*-1')]) {
						if (cancelOp.parent === op.parent) {
							termPairs.push({t1: op, t2: cancelOp});
						}
					} else {
						termMap[opStr] = op;
					}
				});
			});
			
			return termPairs;
		};

		this.getCombinableTerms = function (exp) {
			var termPairs = [];
			var parentMap = {};
			
			[exp.eqData.varOperands, exp.eqData.constOperands].forEach((operands, listIdx) => {
				operands.forEach((op, opIdx) => {
					if (op.parent) {
						let parentStr = op.parent.toString();
						let combineOps;
						if (combineOps = parentMap[parentStr]) {
							combineOps.forEach((combineOp) => termPairs.push({t1: op, t2: combineOp}));
							combineOps.push(op);
						} else {
							parentMap[parentStr] = [op];
						}
						if (opIdx === (operands.length-1) && listIdx === 0) { //done first operand list
							parentMap = {};
						}
					}
				});
			});
			
			return termPairs;
		};

		this.getSubtractableTerms = function (subtractFrom, otherSide) {
			var subtractable = [];
			var fromData = subtractFrom.eqData,
				otherData = otherSide.eqData;
			var allVarTerms = fromData.varOperands,
				varTerms = allVarTerms.filter((vo)=>vo.parent === subtractFrom.tree);
			var constTerms = fromData.constOperands.filter((co)=>co.parent === subtractFrom.tree);
			var addedVars = false;
			if (fromData.hasVar && fromData.hasConst) {
				if (otherData.hasVar && varTerms.length === 1 && 
					!(constTerms.length === 2 && this.areCancelable(constTerms[0], constTerms[1])) &&
					!(otherData.varOperands.length === 2 && this.areCancelable(otherData.varOperands[0], otherData.varOperands[1])) &&
					subtractFrom.varOrConstSide !== "var") 
				{
					subtractable = subtractable.concat(varTerms.filter((vt)=>vt.isSimple));
					addedVars = true;
				} 
				if (otherData.hasConst && constTerms.length === 1 && 
					!(varTerms.length === 2 && this.areCancelable(varTerms[0], varTerms[1])) &&
					!(otherData.constOperands.length === 2 && this.areCancelable(otherData.constOperands[0], otherData.constOperands[1])) &&
					subtractFrom.varOrConstSide !== "const") 
				{
					subtractable = subtractable.concat(constTerms.filter((ct)=>ct.isSimple));
				}
			}
			if (allVarTerms.length === 1 && !addedVars) {
				let vt = allVarTerms[0];
				if (vt.isSimple && vt.coeff === -1 && (vt.parent === subtractFrom.tree || !vt.parent)) {
					//special case: always allow moving x term with coeff of -1
					subtractable.push(vt);
				}
			}
			return subtractable;
		};
		
		this.getNonStrategicSubtractableTerms = function(subtractFrom, otherSide) {
			
		//	console.log("getNonStrategicSubtractableTerms ",subtractFrom, otherSide);
			
			var subtractable = [];
			var fromData = subtractFrom.eqData,
				otherData = otherSide.eqData;
			var varType, constType;
			var varTerms = fromData.varOperands.filter((vo)=>!vo.parent || vo.parent === subtractFrom.tree);
			var constTerms = fromData.constOperands.filter((co)=>!co.parent || co.parent === subtractFrom.tree);
			if (varTerms.length) {
				if (varTerms.length > 1) {
					varType = "like_same_side";
				} else if (!otherData.hasVar || (otherData.varOperands.length === 2 && this.areCancelable(otherData.varOperands[0], otherData.varOperands[1]))) {
					varType = "no_like_other_side";
				} else if (	!constTerms.length || (constTerms.length === 2 && this.areCancelable(constTerms[0], constTerms[1])) ) {
					varType = "no_unlike_same_side";
				}
			}
			
			if (constTerms.length) {
				if (constTerms.length > 1) {
					constType = "like_same_side";
				} else if (!otherData.hasConst || (otherData.constOperands.length === 2 && this.areCancelable(otherData.constOperands[0], otherData.constOperands[1]))) {
					constType = "no_like_other_side";
				} else if (	!varTerms.length || (varTerms.length === 2 && this.areCancelable(varTerms[0], varTerms[1])) ) {
					constType = "no_unlike_same_side";
				}
			}
			
			if (varType) {
				subtractable = subtractable.concat(varTerms.filter((vt)=>vt.isSimple).map((vt)=>{return {term: vt, type: varType}}));
			}
			if (constType) {
				subtractable = subtractable.concat(constTerms.filter((ct)=>ct.isSimple).map((ct)=>{return {term: ct, type: constType}}));
			}
			
		//	console.log('non strategic subtractable terms',subtractable);
			return subtractable;
		};

		this.divisibleBy = function (factors, divisor) {
			let negDivisor = -1*divisor;
			for (let i = 0; i < factors.length; i++) {
				if (factors[i] == divisor || factors[i] == negDivisor || factors[i] === 0) {
					return true;
				}
			}
			return false;
		};

		this.canCancelDivisor = function(expTree, divisor) {
			divisor = ''+divisor;
			var ret = false;
			if (expTree.operator === "TIMES") {
				let factors = expTree.factors;
				for (let i = 0; i < factors.length; i++) {
					if (factors[i].toString() === divisor) {
						ret = true;
						break;
					}
				}
			}
			return ret;
		}
		
		this.getFactors = function (n) {
			n = Math.abs(n);
			let factors = n !== 1 ? [1] : [];
			let nHalf = Math.floor(n/2);
			if (n < 0) {
				for (let f = -2; f >= nHalf; f--) {
					if (n%f === 0) {
						factors.push(f);
					}
				}
			} else {
				for (let f = 2; f <= nHalf; f++) {
					if (n%f === 0) {
						factors.push(f);
					}
				}
			}
			factors.push(n);
			return factors;
		};

		this.isConst = function (tree) {
			switch(tree.operator) {
				case "CONST":
					return true;
				case "VAR":
					return false;
				case "UMINUS":
					return this.isConst(tree.base);
				case "TIMES":
					return tree.factors.every(this.isConst.bind(this));
			}
		};
		
		this.hasNegativeTerms = function(parsedExp) {
			switch(parsedExp.operator) {
				case "CONST":
					return parsedExp.evaluate() < 0;
				break;
				case "VAR":
					return parsedExp.sign < 0;
				break;
				case "PLUS":
					return parsedExp.terms.map((t)=>this.hasNegativeTerms(t)).includes(true);
				break;
				case "TIMES":
					let negs = [parsedExp.sign < 0];
					negs = negs.concat(parsedExp.factors.map((f)=>this.hasNegativeTerms(f))).filter((n)=>n);
					return negs.length%2 !== 0;
				break;
				default:
					console.error("mathUtil.hasNegativeTerms can't handle ",parsedExp.operator);
				break;
			}
		};
		
		this.distributeMultiplication = function(toDistribute, distributeInto, negate) {
			distributeInto = ctap.algParse(distributeInto);
			if (distributeInto.operator === "PLUS") {
				toDistribute = ctap.algParse(toDistribute);
				var toDistributeClones = toDistribute.operator === "PLUS" ? toDistribute.terms.map((t)=>ctap.algParse(t)) : [ctap.algParse(toDistribute)];
				var resStr = '';
				var diClones = distributeInto.terms.map((t)=>ctap.algParse(t));
				toDistributeClones.forEach((tdTerm, tdIdx) => {
					var op = (tdTerm.sign < 0 && negate) || (tdTerm.sign > 0 && !negate) ? "+" : "-";
					tdTerm.sign = Math.abs(tdTerm.sign);
					diClones.forEach((diTerm, diIdx) => {
						if (op === "-" || !(diIdx === 0 && tdIdx === 0)) {
							resStr += op;
						}
						resStr += ctap.algStringify(tdTerm)+'*'+ctap.algStringify(diTerm);
					});
				});
				return resStr;
			}
			return null;
		}

		this.simplifyMultiply = function(factor1, factor2) {
			var simpd = ctap.algSimplify(factor1+"*"+factor2);
			return simpd ? simpd.toString() : null;
		}
		
		this.simplifyMultiplyFraction = function(frac, multiplyBy) {
			var joinTerms = function(terms) {
				let topTerms = terms.filter((nt)=>(typeof nt.exp === "object" ? nt.exp.evaluate() : nt.exp) >= 0),
					btmTerms = terms.filter((dt)=>(typeof dt.exp === "object" ? dt.exp.evaluate() : dt.exp) < 0),
					topStr = topTerms.map((t)=>this.getPrecedence(t.operator) < this.getPrecedence("TIMES") ? '('+t.toString()+')' : t.toString()).join("*"),
					btmStr = btmTerms.map((t)=>{
						ts = ctap.algSimplify(t.toString()+'^-1');
						return this.getPrecedence(t.operator) < this.getPrecedence("TIMES") ? '('+ts+')' : ts;
					}).join("*");
				if (btmTerms.length > 1 || (btmTerms.length === 1 && (this.getPrecedence(btmTerms[0].operator) < this.getPrecedence("DIVIDE")))) {
					btmStr = '('+btmStr+')';
				}
				return topStr + (btmStr ? '/' + btmStr : '');
			}.bind(this);
			var res = [];
			var fracParsed = ctap.algApplyRules(ctap.algParse(frac), ['flatten']);
			var numerTerms = fracParsed.factors.filter((nt)=>(typeof nt.exp === "object" ? nt.exp.evaluate() : nt.exp) >= 0);
			var denomTerms = fracParsed.factors.filter((dt)=>(typeof dt.exp === "object" ? dt.exp.evaluate() : dt.exp) < 0);
			var numerExp = ctap.algParse(joinTerms(numerTerms));
			if (denomTerms.length === 1) {
				let denomScanned = this.scanExpression(denomTerms[0]);
				let numerScanned = this.scanExpression(numerExp);
				let combinedWDenom = ctap.algSimplify(multiplyBy+'*'+denomTerms[0].toString());
				//combine w/ denom
				if (combinedWDenom === "1") {
					res.push(numerExp.toString());
				} else {
					let combinedWDenomTerms = numerTerms.concat(ctap.algParse(combinedWDenom)),
						combinedWDenomTermsStr = joinTerms(combinedWDenomTerms);
					res.push(combinedWDenomStr);
				}
				//combine w/ simple numer
				let simpleNumerTerms = numerTerms.filter((nt)=>this.scanExpression(nt).isSimple);
				simpleNumerTerms.forEach((snt)=>{
					let multiplied = ctap.algParse(ctap.algSimplify(multiplyBy+"*"+snt.toString())),
						multipliedTerms = fracParsed.factors.slice();
					multipliedTerms.splice(fracParsed.factors.indexOf(snt), 1, multiplied);
					let	multipliedStr = joinTerms(multipliedTerms);
					res.push(multipliedStr);
				});
				//combine w/ plus numer (distribute)
				let plusNumerTerms = numerTerms.filter((pnt)=>pnt.operator === "PLUS");
				plusNumerTerms.forEach((pnt)=>{
					let distributed = ctap.algParse(this.distributeMultiplication(multiplyBy, pnt.toString())),
						distributedTerms = fracParsed.factors.slice();
					distributedTerms.splice(fracParsed.factors.indexOf(pnt), 1, distributed);
					let	distributedStr = joinTerms(distributedTerms);
					
					res.push(distributedStr);
				});
				return res;
			} else {
				throw new Error("multiplyFraction got >1 denominator terms: "+frac);
			}				
		}
		
		this.simplifyMultiplyGeneral = function(factor1, factor2) {
			var f1Parsed = CTATAlgebraParser.theParser.algParse(factor1);
			var f2Parsed = CTATAlgebraParser.theParser.algParse(factor2);
			var f1Scanned = this.scanExpression(f1Parsed);
			var f2Scanned = this.scanExpression(f2Parsed);
			var f1All = {str: factor1, scanned: f1Scanned, parsed: f1Parsed};
			var f2All = {str: factor2, scanned: f2Scanned, parsed: f2Parsed};
			var multiplyBy, multiply;
			if (f1Scanned.isSimple) {
				multiplyBy = f1All;
				multiply = f2All;
			} else if (f2Scanned.isSimple) {
				multiplyBy = f2All;
				multiply = f1All;
			} else {
				throw new Error("multiplyGeneral got no simple terms: "+factor1+","+factor2);
			}
			if (multiply.scanned.isSimple) {//both simple
				return this.simplifyMultiply(factor1, factor2);
			} else if (multiply.parsed.operator === "PLUS") {
				return this.distributeMultiplication(multiplyBy.str, multiply.str);
			} else if (multiply.parsed.operator === "TIMES") {
				if (multiply.scanned.operation.includes("divide")) {
					return this.simplifyMultiplyFraction(multiply.str, multiplyBy.str);
				}
			}
			//TODO...
		}

		this.distributeDivision = function(numerator, denominator) {
			distributeInto = CTATAlgebraParser.theParser.algParse(numerator);
			if (distributeInto.operator === "PLUS") {
				toDistribute = CTATAlgebraParser.theParser.algParse(denominator);
				if (toDistribute.operator !== "PLUS") {
					var resStr = '';
					distributeInto.terms.forEach((diTerm, diIdx) => {
						if (diIdx !== 0) {
							resStr += '+'
						}
						resStr += CTATAlgebraParser.theParser.algStringify(diTerm)+'/'+CTATAlgebraParser.theParser.algStringify(toDistribute);
					});
					return resStr;
				} else {
					throw new Error("distributeDivision denominator is PLUS node");
				}
			} else {
				throw new Error("distributeDivision numerator not PLUS node: ",numerator);
			}
			return null;
		}

		this.simplifyDivideProductTerm = function(numerator, denominator) {
			numerator = CTATAlgebraParser.theParser.algParse(numerator);
			if (numerator.operator === "TIMES") {
				toCancel = CTATAlgebraParser.theParser.algParse(denominator).toString();
				if (!isNaN(toCancel)) {
					var foundAtIdx = -1;
					var divisibleFactorIdx = -1;
					for (let idx = 0; idx < numerator.factors.length; idx++) {
						let factor = numerator.factors[idx];
						let fString = factor.toString();
						if (fString === toCancel) {
							foundAtIdx = idx;
						} else if ((+fString)%(+toCancel) === 0) {
							divisibleFactorIdx = idx;
						}
					};
					if (foundAtIdx > -1) {
						numerator.factors.splice(foundAtIdx, 1);
						let res = numerator.toString();
						return res;
					} else if (divisibleFactorIdx > -1) {
						let divisibleFactor = numerator.factors[divisibleFactorIdx];
						let newFactor = CTATAlgebraParser.theParser.algParse(CTATAlgebraParser.theParser.algSimplify(divisibleFactor.toString()+'/'+toCancel));
						numerator.factors.splice(divisibleFactorIdx, 1, newFactor);
						let res = numerator.toString();
						return res;
					}
				}
			}
			return null;
		}


		this.simplifyDivideSimpleTerm = function(numerator, denominator) {
			var simpd = CTATAlgebraParser.theParser.algSimplify(numerator+'/'+denominator);
			return simpd ? simpd.toString() : null;
		}

		this.simplifyDivideGeneral = function(numerator, denominator) {
			var numeratorParsed = CTATAlgebraParser.theParser.algParse(numerator);
			switch(numeratorParsed.operator) {
				case "TIMES":
					return this.simplifyDivideProductTerm(numerator, denominator);
				case "PLUS":
					return this.distributeDivision(numerator, denominator);
				default:
					return this.simplifyDivideSimpleTerm(numerator, denominator);
			}
		}
		
		this.multiplyBy = function(exp, multBy) {
			let expTree = ctap.algParse(exp);
			var higherPrecedence = mathUtil.getPrecedence(expTree.operator) >= mathUtil.getPrecedence("TIMES");
			var expStr = higherPrecedence ? expTree.toString() : "("+expTree+")";
			var res = expStr+'*'+multBy;
			
			return res;
		}
		
		this.divideBy = function(exp, divisor) {
			let expTree = ctap.algParse(exp);
			var higherPrecedence = mathUtil.getPrecedence(expTree.operator) >= mathUtil.getPrecedence("DIVIDE"); 
			var expStr = higherPrecedence ? expTree.toString() : '('+expTree+')';
			var res = expStr+'/'+divisor;

			return res;
		}

		this.combineAllLikePairs = function(eqStr, movedTerm) {
			movedTerm = ctap.algSimplify(movedTerm);
			var ret = [];
			var parsed = ctap.algParse(eqStr);
			var scanned = this.scanExpression(parsed);
			var isConst = !isNaN(movedTerm);
			var likeOperands = isConst ? scanned.constOperands : scanned.varOperands;
			if (likeOperands.length === 1 && likeOperands[0].term === parsed) {
				let newOperand = ctap.algParse(ctap.algSimplify(parsed.toString()+'+'+movedTerm))
				ret.push(newOperand.toString());
			} else {
				likeOperands.forEach((operand)=>{
					if (operand.parent === parsed) {
						let os = operand.term.toString();
						var newOperand = ctap.algParse(ctap.algSimplify(os+'+'+movedTerm));
						var newExp = ctap.algParse(parsed);
						if (newOperand.toString() === "0") {
							newExp.terms.splice(operand.childIdx, 1);
						} else {
							newExp.terms.splice(operand.childIdx, 1, newOperand);
						}
						ret.push(newExp.toString());
					}
				});
			}
			return ret;
		}
	
	}
	
	window.mathUtil = new MathUtil();
})();