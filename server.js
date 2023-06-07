var http = require('http');
var fs = require('fs');
var path = require('path');

function addCORSHeaders(resp) {
	resp.setHeader('Access-Control-Allow-Origin', '*');
	resp.setHeader('Access-Control-Allow-Headers', 'ctatsession, Content-Type, Accept');
	resp.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	resp.setHeader('Access-Control-Max-Age', '1728000');
}

function doPost(req, resp) {
	let reply = "POST url not found: "+req.url;
	let postData = "";
	//console.log(req, resp);
	req.on("data", data => {postData+=data;return postData});
	switch(req.url) {
	case "/log/server":
        console.log('got end on /log/server')
		req.on("end", () => {
			addCORSHeaders(resp);
			logServer(resp, postData);
		});
		break;
	case "/problemSelector":
		req.on("end", () => {
            console.log('got end on selector');
			addCORSHeaders(resp);
			resp.setHeader('Content-Type', 'application/json');

			let tsInfo = JSON.parse(postData);
            //console.log(tsInfo.problems)
            //console.log(tsInfo.skills)
            //console.log(checkAllSkillsMastered(tsInfo))

			let result = getResult(tsInfo);

            console.log('got until end');
			// Send the response JSON
			resp.end(JSON.stringify(result));
		});
		break;
	default:
		req.on("end", () => {
			addCORSHeaders(resp);
			resp.writeHead(404, {
				'Content-Length': Buffer.byteLength(reply,'utf8'),
				'Content-Type': 'text/plain'
			});
			response.end(reply);
		});
	}
}

function getResult(tsInfo) {
    let easiestUnmasteredSkill = getEasiestUnmasteredSkill(tsInfo);
    if (checkWantsFocusPractice(tsInfo)) {
        console.log('Wants Focus Practice detected')
        console.log('Easiest Unmastered Skill: '+easiestUnmasteredSkill);
        var selectedProblem = findSmallestProblemBySkillName(tsInfo, easiestUnmasteredSkill);
    } else {
        console.log('Default practice. Advancing to next problem.')
        var last = tsInfo.dynamic_model?.current_problem_no || 0; 
        var selectedProblem = tsInfo.problems[last]?.name || ''
    }
    console.log('Selected problem '+selectedProblem);
    console.log('Variables: '+getVariableValues(tsInfo));
    let result={
        problem_name: checkAllSkillsMastered(tsInfo) ? '' : selectedProblem,//simple selection:// tsInfo.problems[last]?.name || '',
        dynamic_model: {},
    };
    result.dynamic_model.current_problem_no = (last < tsInfo.problems?.length ? ++last : 0);
    return result
}

function checkWantsFocusPractice(tsInfo) {
    for (let i = 0; i < tsInfo.variables.length; i++) {
        const variable = tsInfo.variables[i];
        if (
        variable.name === "wants_focused_practice" &&
        variable.value.state === "on"
        ) {
        return true;
        }
    }
    return false;
}

function getVariableValues(tsInfo) {
    const variableValues = [];
    for (let i = 0; i < tsInfo.variables.length; i++) {
        const variable = tsInfo.variables[i];
        variableValues.push(variable.name);
        variableValues.push(variable.value.state);
    }
    return variableValues;
}

function findSmallestProblemBySkillName(tsInfo, skillName) {
    // Takes tsInfo and skillname and returns 
    // a problem name with the skillName inside it
    // with the least number of other skills possible.
    // Random selection between multiple matches.
    let matchingProblems = [];
    let minLength = Infinity;
  
    for (let i = 0; i < tsInfo.problems.length; i++) {
      const problem = tsInfo.problems[i];
      if (problem.skill_names && problem.skill_names.includes(skillName)) {
        if (problem.skill_names.length < minLength) {
          matchingProblems = [problem];
          minLength = problem.skill_names.length;
        } else if (problem.skill_names.length === minLength) {
          matchingProblems.push(problem);
        }
      }
    }
  
    if (matchingProblems.length > 0) {
      const randomIndex = Math.floor(Math.random() * matchingProblems.length);
      return matchingProblems[randomIndex].name;
    } else {
      return null;
    }
  }

function getMasteryLevels(tsInfo) {
    let pKnownValues = [];
    for (let i = 0; i < tsInfo.skills.length; i++) {
        if (tsInfo.skills[i].hasOwnProperty("p_known")) {
        pKnownValues.push(tsInfo.skills[i]["p_known"]);
        }
    }
    return pKnownValues;
}

function checkAllSkillsMastered(tsInfo) {
    values = getMasteryLevels(tsInfo);
    if (values.length === 0) { // initial problem setup
        return false;
    }
    for (let i = 0; i < values.length; i++) {
        if (values[i] < 0.95) {
        return false;
        }
    }
    return true;
}

function getEasiestUnmasteredSkill(tsInfo, threshold=0.95) {
    let maxPKnown = -Infinity;
    let maxPKnownIndex = -1;

    for (let i = 0; i < tsInfo.skills.length; i++) {
        if (tsInfo.skills[i].hasOwnProperty("p_known") && tsInfo.skills[i]["p_known"] < threshold) {
            if (tsInfo.skills[i]["p_known"] > maxPKnown) {
                maxPKnown = tsInfo.skills[i]["p_known"];
                maxPKnownIndex = i;
            }
        }
    }

    if (maxPKnownIndex !== -1) {
        return tsInfo.skills[maxPKnownIndex]["identity"];
    } else {
        return null;
    }
}

http.createServer(function (req, response) {
    //console.log('req?headers', req.headers? req.headers : req);
    //console.log(req.socket.remoteAddress);
	if(/:127[.]0+[.]0+[.]1/.test(req.socket.remoteAddress) || /:128[.]2[.][0-9]+[.][0-9]+/.test(req.socket.remoteAddress)) {
		console.log('url, method', req.url, req.method);
	} else {
		req.end("");
		return;
	}

	if(req.method == "POST") {
		return doPost(req, response);
	}

    var filePath = '.' + req.url;
    if (filePath == './') {
        filePath = './index.html';
    }

    var extname = String(path.extname(filePath)).toLowerCase();
    var mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.svg': 'application/image/svg+xml'
    };

    var contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, function(error, content) {
        if (error) {
            if(error.code == 'ENOENT') {
                fs.readFile('./404.html', function(error, content) {
                    response.writeHead(200, { 'Content-Type': contentType });
                    response.end(content, 'utf-8');
                });
            }
            else {
                response.writeHead(500);
                response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
                response.end();
            }
        }
        else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });

}).listen(3000);
console.log('Server running at http://127.0.0.1:3000/');


//DataShop log server
function logServer(response, data) {
    console.log("in logServer data", data);
    var prefix = "LogService-";
    var name = String(data).match(/session_id=["]([^"]+)["]/);
    var path = prefix+(name?name[1]:"NoSessionId")+".xml";
    var status = 200;
    var reply = 'status=success';
    var fd = null;
    try {
		console.log("open: path", path);
		fd = fs.openSync(path, 'a');
		console.log("append: fd", fd);
		fs.appendFileSync(fd, data, 'utf8');
    } catch (e) {
		console.trace(e);
		status = 500;
		reply = String(e);
    } finally {
		if (fd) {
			console.log("close: fd", fd);
			fs.closeSync(fd);
		}
    }
    response.writeHead(status,
	{
	    'Content-Length': Buffer.byteLength(reply,'utf8'),
	    'Content-Type': 'text/plain'
	});
    response.end(reply);
}