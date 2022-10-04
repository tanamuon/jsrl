/*
rot.js license:

Copyright (c) 2012-now(), Ondrej Zara
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, 
are permitted provided that the following conditions are met:

	* Redistributions of source code must retain the above copyright notice, 
	  this list of conditions and the following disclaimer.
	* Redistributions in binary form must reproduce the above copyright notice, 
	  this list of conditions and the following disclaimer in the documentation 
	  and/or other materials provided with the distribution.
	* Neither the name of Ondrej Zara nor the names of its contributors may be used 
	  to endorse or promote products derived from this software without specific 
	  prior written permission.
			
THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND 
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED 
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. 
IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, 
INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, 
BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, 
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY 
OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING 
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, 
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

var FOV =7;
var player;
var humanoid = {grasp:2, head:1, torso:1, arm:2, hand:2, leg:2, foot:2}; // 2 = # of grasp parts (hands)
//feet: [feet, 2]

function randInt(min, max) { // inclusive
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(ROT.RNG.getUniform() * (max - min + 1)) + min;
}
function randCoords(maxX, maxY) {
	return [ randInt(1, maxX-1), randInt(1, maxY-1) ];
}
function randXY(d=1) {
	return [ randInt(-d, d), randInt(-d, d) ];
}
function isAdjacent(x1, y1, x2, y2) {
	if (Math.abs(x1-x2) <= 1 && Math.abs(y1-y2) <= 1 && !(x1-x2 === 0 && y1-y2 === 0) ) {
		return true;
	}
	return false;
}
function isDiagonal(x1,y1,x2,y2) {
	let xDis = Math.abs(x1-x2);
	let yDis = Math.abs(y1-y2);
	if (xDis === yDis && xDis !==0) return true;
	return false;
}
class Level {
	constructor(data, create=true) {
		if (create) {
			this.data = {
				id: data.id,
				type: 'l',
				lk: data.lk,
				x: data.x,
				y: data.y,
				parent: null
			};
			this._map = this.dig();
			this.data.tiles = this._map._map;
			// create zero filled map for remembering what the player has visited
			this.data.drawMap = Array(data.x).fill().map(()=> Array(data.y).fill(['','','']));
			this.placeFeatures();
		} else {
			this.data = data;
		}
	}
	setParent(parent) {
		this.data.parent = parent;
	}
	dig() {
		let map = new ROT.Map.Uniform(this.data.x, this.data.y);
		map.create();
		return map;
	}
	placeFeatures() {
		this.data.entrance = this.getValidPlacement();
		this.data.exit = this.getValidPlacement();
		this.data.tiles[this.data.entrance[0]][this.data.entrance[1]] = "entrance";
		this.data.tiles[this.data.exit[0]][this.data.exit[1]] = "exit";
	}
	getTile(x, y) {
		let tile = null;
		let ib = this.inbounds(x, y);
		if (ib) {
			tile = tileTypes[this.data.tiles[x][y]];
		} else { // ensure wall border
			tile = tileTypes[1];
		}
		return tile;
	}
	inbounds(x, y) {
		let maxX = this.data.x;
		let maxY = this.data.y;
		let xOkay = false;
		let yOkay = false;
		if ( x > 0 && x < maxX-1 ) { xOkay = true; }
		if ( y > 0 && y < maxY-1 ) { yOkay = true; }
		if (xOkay && yOkay) {
			return true;
		} else {
			return false;
		}
	}
	walkable(x, y) { // this is really buggy
		let tile = this.getTile(x, y);
		return tile.bools.w;
	}
	movable(x, y) {
		if ( !this.inbounds(x,y) ) { return false; }
		if ( !this.walkable(x,y) ) { return false; }
		return true;
	}
	changeTile(x,y,newTile) {
		if ( !this.inbounds(x,y) ) return false;
		this.data.tiles[x][y] = newTile;
		return true;
	}
	getValidPlacement() {
		let x, y;
		for (let i=0; i<100; i++) {
			[x, y] = randCoords(this.data.x, this.data.y);
			if (this.walkable(x, y)) return [x, y];
		}
	}
	getNeighbors(x,y,r,onlyWalkable=false) {
		let valid = [];
		for (let i=-r; i<r+1; i++) {
			for (let j=-r; j<r+1; j++) {
				if (this.inbounds(x+i, y+j) && (i !== 0 || j !== 0)) {
					valid.push([x+i, y+j]);
				}
			}
		}
		if (onlyWalkable) {
			for (let s of valid) {
				if ( !this.walkable(s[0], s[1])  ) {
					valid.splice(valid.indexOf(s), 1);
				}
			}
		}
		return valid;
	}
	putNearby(x, y, d, n) {
		let x1 = Math.max(x-d, 1);
		let y1 = Math.max(y-d, 1);
		let x2 = Math.min(x+d, this.data.x-1);
		let y2 = Math.min(y+d, this.data.y-1);
		let locs = this.data.tiles.splice(x-d, x+d).map( (x) => x.splice(y-d, y+d));
	}
	magicMap() {
		for (let i in this.data.tiles) {
			for (let j in this.data.tiles[i]) {
				let tile = this.getTile(i,j);
				let [c, fg, bg] = [tile.vis.c, tile.vis.fg, tile.vis.bg];
				this.data.drawMap[i][j] = [c, fg, bg];
			}
		}
	}
}

class Unit {
	constructor(data, create=true) {
		if (create) {
			this.data = {...data};
			this.data = {
				id: data.id,
				name: data.name,
				type: 'u',
				x: data.x,
				y: data.y,
				dx: 0,
				dy: 0,
				d:data.d,
				exp:data.exp,
				recentMoves: [],
				delay: 0,
				vis: {...data.vis},
				flags: [...data.flags],
				slots: {...data.slots},
				p: false,
				stats: {...data.stats},
				buffs: [],
				lk: data.lk,
				inventory: [],
				equipment: {},
				fov: [],
				unitsInFov: [],
				path: [],
				goal: [],
				parent: null,
				reachedGoal: false,
				state: "WANDERING",
				reachedGoal: false,
				turnsWaited: 0
			};
			if (data.p) {
				this.data.p = true;
			}
			this.oblist = {
				inventory: []
			};
			// I don't know why this needs to be here but it does
			this.data.stats.chp = this.data.stats.mhp;
		} else { // untested
			this.data = data;
			this.oblist = {
				inventory: [] // need to get from game object
			};
		}
	}
	addBuff(buff) {
		buff = {...buff}
		buff.turnsRemaining = buff.endsAfter;
		this.data.buffs.push(buff);
	}
	removeBuff(buff) {
		let i = this.data.buffs.indexOf(buff);
		if (i >= 0) {
			this.data.buffs.splice(i,1);
		}
	}
	manageBuffs() {
		for (let buff of this.data.buffs) {
			if (buff.turnsRemaining <= 0) {
				this.removeBuff(buff);
			}
			buff.turnsRemaining--;
		}
	}
	getBuffAmount(stat) {
		let add = 0;
		for (let buff of this.data.buffs) {
			if (buff.stat === stat) {
				add += buff.amount;
			}
		}
		return add;
	}
	addExp(n) {
		this.data.exp += n;
	}
	getRes() {
		return this.data.stats.res + this.getBuffAmount("res");
	}
	getStr() {
		return this.data.stats.str + this.getBuffAmount("str");
	}
	getSpeed() {
		let speed = this.data.stats.speed;
		if ( !speed ) speed = 10;
		return speed;
	}
	getCombatStrength() {
		return this.data.stats.chp*this.data.stats.str;
	}
	delay(n=this.getSpeed()) {
		this.data.delay += n;
	}
	spendDelay() {
		let t = this.data.delay;
		this.data.delay = 0;
		return t;
	}
	hasFlag(flag) {
		return this.data.flags.includes(flag);
	}
	setParent(parent) {
		this.data.parent = parent;
	}
	getItem() {
		let item = this.data.parent.itemThere(this.data.x, this.data.y, -1);
		if ( !item ) { return false; }
		let unit = this;
		item.pickup(unit);
		this.data.parent.addMessage("You pick up the "+item.data.name+".");
		this.delay(this.getSpeed());
		return true;
	}
	interact(x=this.data.x, y=this.data.y) {
		return this.data.parent.getInteraction(x,y,this);
	}
	turn() {
		this.manageBuffs();
		if (player.data.unitsInFov.length <= 0) {
			this.regenStamina();
		}
		this.alterHP(this.getBuffAmount("chp"));
		this.dieCheck();
		if ( !this.data.p ) {
			this.ai();
		}
	}
	ai() {
		if (this.data.p) { return; }
		if (player.data.unitsInFov.includes(this)) {
			this.data.goal = player.getLoc();
			this.data.state = "AGGRESSIVE";
		} else if (this.data.state === "AGGRESSIVE" || this.data.state === "HUNTING") {
			this.data.state = "HUNTING";
		} else {
			this.data.state = "WANDERING";
		}
		
		// go to random location
		if (this.data.state === "WANDERING" || this.data.state === "HUNTING") {
			this.moveTowardsGoal();
		} else if (this.data.state === "AGGRESSIVE") {
			this.naiveMoveTowards();
		}
	}
	naiveMoveTowards() {
		let x, y, dx, dy;
		if (this.data.state === "AGGRESSIVE") {
			this.shoutWarning();
		}
		if (this.data.goal) {
			x = this.data.goal[0];
			y = this.data.goal[1];
			dx = 0;
			if (x > this.data.x) {
				dx = 1;
			} else if (x < this.data.x) {
				dx = -1;
			}
			// remember that dy of -1 is an up move
			dy = 0;
			if (y > this.data.y) {
				dy = 1;
			} else if (y < this.data.y) {
				dy = -1;
			}
		} else {
			dx = this.data.dx;
			dy = this.data.dy;
			x = this.data.x + this.data.dx;
			x = this.data.x + this.data.dx;
		}
		this.data.dx = dx;
		this.data.dy = dy;
		let direction = numpad[dx][dy];
		let order = moveBias[direction];
		function isCorridor(x, y, parent) {
			if ( !parent.walkable(x-1, y) && !parent.walkable(x+1, y) ) {
				return 1;
			} else if ( !parent.walkable(x, y-1) && !parent.walkable(x, y+1) ) {
				return 2;
			}
			return false;
		}
		function isBlockingAllies(x, y, tx, ty, thisUnit, parent) {
			// calculate distance from ally
			let ax = x - tx;
			let ay = y - ty;
			/* 
			 * #o#
			 * #o#
			 * .@.
			 */
			if (isCorridor(x, y, parent) === 1) { 
				if (parent.unitThere(x, y+ay, thisUnit, true) ) {
					return true;
				}
			}
			/* 
			 * ##.
			 * oo@
			 * ##.
			 */
			else if (isCorridor(x, y, parent) === 1) { 
				if (parent.unitThere(x+ax, y, thisUnit, true) ) {
					return true;
				}
			}
			return false;
		}
		function allyCount(moveVector, thisUnit) {
			let adjacentAllies = 0;
			for (let mn of moveVector) {
				if (thisUnit.data.parent.unitThere(mn[0],mn[1],thisUnit,true)) {
					adjacentAllies++;
				}
			}
			return adjacentAllies;
		}
		var thisUnit = this;
		let inCorridor = isCorridor(this.data.x, this.data.y, this.data.parent);
		let blocking = isBlockingAllies(this.data.x, this.data.y, x, y, thisUnit, this.data.parent);
		if (isAdjacent(this.data.x, this.data.y, x, y) && (x===player.data.x && y===player.data.y) /*hack*/) {
			// get array of adjacent squares
			let myNeighbors = this.data.parent.getNeighbors(this.data.x, this.data.y, 1, true);
			let adjacentAllies = allyCount(myNeighbors, thisUnit); // number of adjacent allies
			// initialize desirability value for each square
			myNeighbors = myNeighbors.map( (x) => x = [x[0], x[1], 0] );
			for (let i in myNeighbors) {
				let nx = myNeighbors[i][0];
				let ny = myNeighbors[i][1];
				let unit = this.data.parent.unitThere(nx, ny, this);
				if ( !isAdjacent(nx, ny, x, y) ) {
					// remove squares not adjacent to target or that have units in them
					myNeighbors.splice(i,1);
				} else {
					let adjacent = isAdjacent(nx, ny, x, y);
					let corridor = isCorridor(nx, ny, this.data.parent);
					let neighbors = this.data.parent.getNeighbors(nx, ny, 1, true);
					let surround = allyCount(neighbors, thisUnit) < adjacentAllies;
					// corners are low value for surrounds
					// 4 should be 3 but there is a bug in getNeighbors
					if (neighbors.length === 3 && !corridor) {
						continue;
					}
					/*
					 * move if in a corridor and allies are behind:
					 * .## -> o## -> o##
					 * @oo -> @.o -> @o.
					 * .## -> .## -> .##
					 * or:
					 * ##o# -> ##o# -> ##.#
					 * ##o# -> ##.# -> ##o#
					 * ..@# -> .o@# -> .o@#
					 * #### -> #### -> ####
					 */
					if (blocking) {
						myNeighbors[i][2] += 5;
					}
					/*
					* move into unoccupied corridor to potentially block players escape:
					* #.# -> #o# || .o# -> ..#
					* .@o -> .@. || .@. -> .@o
					* o.. -> o.. || o.# -> o.#
					* or (surround check also catches):
					* ##### -> #####
					* .o@## -> .o@##
					* ##o.. -> ##.o.
					* ##### -> #####
					*/
					if (corridor && !inCorridor) {
						myNeighbors[i][2] += 3;
					}
					/*
					 * move to a square with fewer adjacent allies to facilitate surrounds:
					 * ... -> ... -> ...
					 * .o@ -> .o@ -> .o@
					 * oo. -> o.o -> .oo
					 */
					if (surround) {
						myNeighbors[i][2] += 2;
					}
					/*
					* .o. -> o..
					* .@. -> .@.
					* .o. -> .o.
					*/
// 					if ( (Math.abs(myNeighbors[i][0]-x) > 0 && Math.abs(myNeighbors[i][1]-y) > 0) &&
// 						!surround &&
// 						!this.data.parent.unitThere(myNeighbors[i][0]+2*dx, myNeighbors[i][1]+2*dy, this, true) ) {
// 						console.log("can move to diagonal");
// 						myNeighbors[i][2] += 1;
// 					}
				}
			}
			
			myNeighbors = myNeighbors.filter( (x) => x[2]>0 );
			myNeighbors = myNeighbors.sort( (a, b) => b[2] - a[2] );
			if (myNeighbors.length) {
				return this.moveTo(myNeighbors[0][0], myNeighbors[0][1]);
			}
			else {
				return this.moveTo(x, y);
			}
		} else { // don't try to surround or attack
			for (let o of order) {
				let m = reverseNumpad[o];
				let ally = this.data.parent.unitThere(m[0]+this.data.x,m[1]+this.data.y,this,true);
				if (ally && this.getCombatStrength() > 2*ally.getCombatStrength() && player.data.unitsInFov.includes(this) && inCorridor) {
					this.data.parent.addMessage("The "+this.data.name+" pushes past the "+ally.data.name+".");
					return this.switchPlaces(ally);
				}
				if (this.data.parent.movable(this.data.x+m[0],this.data.y+m[1])) {
					return this.move(m[0],m[1]);
				}
			}
		}
		let neighbors = this.data.parent.getNeighbors(this.data.x, this.data.y, 1, true);
		
		for (let s of this.data.recentMoves) {
			// includes() doesn't work with 2d arrays
			neighbors = neighbors.filter( (x) => x[0] !== s[0] || x[1] !== s[0]  );
		}
		if (neighbors.length) {
			return this.moveTo(neighbors[0][0], neighbors[0][1]);
		}
		this.delay(1);
	}
	moveTowardsGoal() {
		let rg = this.reachedGoal();
		let goalValid = this.data.goal[0]*this.data.goal[1];
		if (rg || !goalValid) {
			this.pickGoal();
		}
		if ( !this.data.path.length ) {
			this.pathfind();
		}
		if ( !this.data.path.length ) {
			return;
		}
		let [nx, ny] = this.data.path[0];
		let success = this.moveTo(nx, ny);
		if (success) {
			this.data.path.shift();
		}
	}
		pickGoal() {
			this.data.goal = this.data.parent.oblist.currentLevel.getValidPlacement();
		}
		reachedGoal() {
			if (this.data.reachedGoal) return true;
			let l = 1;
			if ( Math.abs(this.data.x-this.data.goal[0])<l && Math.abs(this.data.y - this.data.goal[1])<l ) { // will need to check LoS later
				this.data.reachedGoal = true;
				return true;
			}
			return false;
		}
		pathfind() {
			let [x, y] = this.data.goal;
			var thisUnit = this;
			var dijkstra = new ROT.Path.Dijkstra(x, y, (x,y) => thisUnit.data.parent.walkable(x,y));
			var path = [];
			dijkstra.compute(thisUnit.data.x, thisUnit.data.y, (x,y) => path.push([x,y]) );
			path.shift(); // remove units current location
			this.data.path = path;
		}
	switchPlaces(unit) {
		let tx = this.data.x;
		let ty = this.data.y;
		this.data.x = unit.data.x;
		this.data.y = unit.data.y;
		this.data.path.shift();
		this.delay(this.getSpeed());
		unit.data.x = tx;
		unit.data.y = ty;
		unit.data.path.shift();
		unit.delay(unit.getSpeed());
	}
	shoutWarning() {
		/*
		 * this is kind of a buggy cludge because enemies lose track of player too easily.
		 */
		let r = 7;
		let queue = [];
		let units = this.data.parent.othersInRange(this.data.x, this.data.y, r);
		for (let unit of units) {
			if (unit.data.state !== "AGGRESSIVE") {
				unit.data.state = "AGGRESSIVE";
				unit.data.goal = this.data.goal;
			}
		}
// 		if (units.length) { this.delay(); }
		// it would be weird if they just rushed off without saying a word to their buddies
		for (let shouter in queue) {
			shouter.shoutWarning();
		}
		
	}
	moveTo(nx, ny) {
		let dx = nx - this.data.x;
		let dy = ny - this.data.y;
		return this.move(dx, dy);
	}
	move(dx, dy) {
		// reduce magnitude of dx/dy to unit's move if it's higher
		if (Math.abs(dx) > this.data.stats.move) dx = this.data.stats.move * dx/Math.abs(dx);
		if (Math.abs(dy) > this.data.stats.move) dy = this.data.stats.move * dy/Math.abs(dy);
		let newX = this.data.x + dx;
		let newY = this.data.y + dy;
		if (this.isAt(newX, newY)) { return 0; }
		let unit = this.data.parent.unitThere(newX, newY, this, false);
		let timeTaken = 1;
		if (unit && this.data.p === unit.data.p ) {
// 			if ((unit.data.goal[0] === this.data.x && unit.data.goal[1] === this.data.y) ||
// 				unit.getCombatStrength() > 2*this.getCombatStrength() ) {
				this.switchPlaces(unit);
				return false;
		} else if (unit && this.data.p !== unit.data.p) {
			unit.getAttacked(this);
			timeTaken = this.getSpeed();
			this.delay(timeTaken);
			this.turnsWaited = 0;
			return true;
		} else if ( this.data.parent.movable(newX, newY) ) {
			this.data.x += dx;
			this.data.y += dy;
			timeTaken = this.getSpeed();
			this.delay(timeTaken);
			this.turnsWaited = 0;
			return true;
		}
		this.delay(timeTaken);
		this.turnsWaited++;
		return false;
	}
	getAC(slot) {
		let min = 0;
		let max = 0;
		let gear = this.data.equipment[slot];
			if (gear) {
				min += gear.data.dice;
				max += gear.data.sides;
			}
		return [min, max];
	}
	rollAC(slot) {
		let ac = this.getAC(slot);
		return randInt(ac[0],ac[1]) + this.data.stats.res;
	}
	getDamage() {
		let min = 0;
		let max = 0;
		let armed = false;
		for (let slot of Object.values(this.data.equipment)) {
			if (slot.data.type === "weapon") {
				min += slot.data.dice;
				max += slot.data.sides;
				armed = true;
			}
		}
		let str = this.getStr();
		min += str;
		max += str;
		if ( !armed ) {
			min = 1;
			max = str;
		}
		return [min, max];
	}
	rollDamage() {
		let dmg = this.getDamage();
		return randInt(dmg[0],dmg[1]);
	}
	alterStamina(n) {
		if (this.data.stats.cstam + n <= this.data.stats.mstam && this.data.stats.cstam + n >= -2*this.data.stats.mstam) {
			this.data.stats.cstam += n;
		}
	}
	regenStamina() { // should regen by waiting or with no enemies in sight
		if (this.data.stats.cstam + 1 <= this.data.stats.mstam) {
			this.data.stats.cstam++;
		}
	}
	getMelee() {
		let pen = 1;
		if (this.data.stats.cstam <= -1*this.data.stats.mstam) {
			pen = 0.25;
		} else if (this.data.stats.cstam < 0
			
		) {
			pen = 0.5;
		}
		return Math.round(this.data.stats.melee*pen);
	}
	getAttacked(attacker) {
		let am = attacker.getMelee();
		let dm = this.getMelee();
		let hitOdds = am/(dm+am);
		let target = Object.keys(this.data.slots)[randInt(1, Object.keys(this.data.slots).length - 1)];
		if ( !target ) {
			target = "torso";
		}
		let hit = Math.random() < hitOdds;
		let dmg = attacker.rollDamage()-this.rollAC(target);
		let armor = this.data.equipment[target];
		if ( !armor ) {
			armor = "skin";
		}
		dmg = Math.max(dmg, 0);
		if (this.hasFlag("INVINCIBLE")) dmg = 0;
		let msg = '';
		if ( attacker.data.p ) {
			if (hit) {
				this.alterHP(-dmg);
				msg = "You hit the "+this.data.name+"'s "+target+" and deal "+dmg+" damage.";
			} else {
				msg = "You miss the "+this.data.name+".";
			}
		} else {
			if (hit) {
				this.alterHP(-dmg);
				msg = "The "+attacker.data.name+" hits your "+target+" and deals "+dmg+" damage.";
			} else {
				msg = "The "+attacker.data.name+" misses.";
			}
		}
		msg += " ("+am+ " " +Math.round(hitOdds*100)+"%)";
		this.data.parent.addMessage(msg);
		
		attacker.alterStamina(-1);
		
		let killed = this.dieCheck();
		if (killed) {
			if (!this.data.p) {
				attacker.addExp(this.data.d[4])
			}
		}
	}
	dieCheck() {
		if (this.data.stats.chp <= 0) {
			if (this.data.p) {
				this.data.parent.killPlayer();
			} else {
				this.data.parent.unitKilled(this);
			}
			return true;
		}
		return false;
	}
	alterStat(stat, amount) {
		this.data.stats[stat] += amount;
	}
	alterHP(amount) {
		this.data.stats.chp += amount;
	}
	getTile() {
		return [this.data.vis.c, this.data.vis.fg, this.data.vis.bg];
	}
	getLoc() {
		return [this.data.x, this.data.y];
	}
	isAt(x, y) {
		if (this.data.x === x && this.data.y === y) return true;
		return false;
	}
	fov() {
		var goal = this.data.goal;
		let unit;
		var parent = this.data.parent; // var not let due to this/callback issues
		var level = parent.oblist.currentLevel;
		this.data.fov = [];
		this.data.unitsInFov = [];
		var thisUnit = this;
		const fov = new ROT.FOV.PreciseShadowcasting((x,y) => parent.walkable(x,y));
		function fovBack(x, y, r, visibility) {
			if (r) thisUnit.data.fov.push([x, y]);
			if (thisUnit.data.p) {
				let level = thisUnit.data.parent.oblist.currentLevel;
				let dm = level.data.drawMap;
				let tile = level.getTile(x, y);
				let [c, fg, bg] = [tile.vis.c, tile.vis.fg, tile.vis.bg];
				dm[x][y] = [c, fg, bg];
				let item = thisUnit.data.parent.itemThere(x, y, -1);
				if (item) {
					[c, fg, bg] = item.getVis();	
					dm[x][y] = [c, fg, bg];
				}
			}
			let unit = parent.unitThere(x, y, -1);
			if (unit && unit !== thisUnit) {
				thisUnit.data.unitsInFov.push(unit);
			}
		}
		fov.compute(this.data.x, this.data.y, FOV, fovBack);
		// stonesense check
		if (this.hasFlag("SENSE_STONE")) {
			let search = level.getNeighbors(this.data.x, this.data.y, 2);
			for (let coords of search) {
				let tile = level.getTile(coords[0], coords[1]);
				if (tile.bools.w && level.data.drawMap[coords[0]][coords[1]][0] === '') {
					level.data.drawMap[coords[0]][coords[1]] = [tile.vis.c, tile.vis.fg, tile.vis.bg];
				}
			}
		}
		// \\
	}
	equip(item) {
		if (this.data.slots[item.data.slot]) {
			this.data.equipment[item.data.slot] = item;
			return true;
		}
	}
	unequip(item) {
		delete this.data.equipment[item.data.slot];
	}
}
// player = new Unit({c:"@", id:-1, lk:0, p:true, vis:{c:"@", fg:"white"}, stats: {mhp:25, chp:25, mstam:8, cstam:8, melee:5, str:5, res:2}, flags: [ "INVINCIBLE", "DEBUG"], slots:{...humanoid}, exp:0});
player = new Unit({c:"@", id:-1, lk:0, p:true, vis:{c:"@", fg:"white"}, stats: {mhp:25, chp:25, mstam:8, cstam:8, melee:5, str:5, res:2}, flags: [], slots:{...humanoid}, exp:0});
class Item {
	constructor(idata, create=true) {
		if (create) {
			this.equippable = idata.equippable;
			this.data = idata;
			this.data.owner = null;
			this.data.name = idata.name;
			this.data.loc = {x: idata.x, y: idata.y, owner: "floor"};
		} else { // untested
			this.data = idata;
		}
	}
	setParent(parent) {
		this.data.parent = parent;
	}
	spendDelay() {
		return 10;
	}
	pickup(unit) {
		this.data.loc.owner = unit.data.id;
		this.data.loc.x = null;
		this.data.loc.y = null;
	}
	drop(unit) {
		this.data.loc.x = unit.data.x;
		this.data.loc.y = unit.data.y;
		this.data.loc.owner = "floor";
	}
	getVis() {
		return [this.data.vis.c, this.data.vis.fg, this.data.vis.bg];
	}
	equip() {
		this.equipped = true;
	}
	unequip() {
		this.equipped = false;
	}
}

class Game {
	constructor(x, y, data) {
		this.data = { // this no longer makes sense, or needs to be expanded
			lk: data.lk,
			turn: 0,
			unitsCreated: 0,
			itemsCreated: 0,
			levelsCreated: 0,
			messages: [],
// 			messageHTML: document.getElementsByClassName("messages")[0],
			statusHTML: document.getElementsByClassName("status")[0],
			allMessagesHTML: document.getElementById("messages-all")
		};
		this.oblist = {
			currentLevel: null,
			currentLevelItems: [],
			currentLevelUnits: [],
			activeScreen: null,
			canvas: data.html,
			bscreen: new BattleScreen({x:x, y:y, parent:this, html:data.html, autoHide:false}),
			iscreen: new InventoryScreen({x:x, y:y, parent:this, html:document.getElementsByClassName("inventory")[0], autoHide:true}),
			scheduler: new ROT.Scheduler.Action(),
		};
		this.oblist.dscreen = this.oblist.bscreen;
		this.switchScreen(this.oblist.bscreen);
	}
	init() {
		this.setLevel(levels[this.data.lk]);
		for (let item of items[this.data.lk]) this.addItem(item);
		for (let unit of units[this.data.lk]) this.addUnit(unit);
		this.addUnit(player);
		this.oblist.activeScreen.draw();
	}
	save() {
		levels[this.data.lk] = this.oblist.currentLevel;
		units[this.data.lk] = this.oblist.currentLevelUnits;
		items[this.data.lk] = this.oblist.currentLevelItems;
	}
	clearData() {
		this.data.messages = [];
		for (let item of items[this.data.lk]) this.removeItem(item);
		for (let unit of units[this.data.lk]) this.removeUnit(unit);
		this.removeUnit(player);
	}
	newGame() {
		this.clearData();
		player = new Unit({c:"@", id:-1, lk:0, p:true, vis:{c:"@", fg:"white"}, stats: {mhp:25, chp:25, mstam:8, cstam:8, melee:5, str:5, res:2}, flags: [], slots:{...humanoid}, exp:0});
		Forger.prepareLevel({lk:0});
		this.addMessage("You are the '@'. Stand over something to pick it up or interact with it, walk into an enemy to attack. Find the downstairs (>). Death is permanent.");
		game.init();
		player.fov();
		game.turn();
		game.display();
	}
	killPlayer() {
		this.newGame();
		this.addMessage("Looks like you died. No big deal, here's a new character.");
	}
	// unit code
		addUnit(unit) {
			unit.setParent(this);
			this.oblist.currentLevelUnits.push(unit);
			this.oblist.scheduler.add(unit,true,unit.getSpeed());
		}
		newUnit() {
			this.data.unitsCreated++;
		}
		removeUnit(unit) {
			this.oblist.currentLevelUnits.splice(this.oblist.currentLevelUnits.indexOf(unit), 1);
			this.oblist.scheduler.remove(unit);
		}
		unitThere(newX, newY, asker=null, onlyCountAllies=false) {
			for (let unit of this.oblist.currentLevelUnits) {
				if (unit.isAt(newX, newY) && ( !asker || asker !== unit) && ( !onlyCountAllies || asker.data.p === unit.data.p) ) {
					return unit;
				}
			}
			return false;
		}
		unitKilled(unit) {
			this.addMessage("The "+unit.data.name+" dies.");
			let [c, fg, bg] = unit.getTile();
			let [x, y] = unit.getLoc();
			let corpse = new Item({lk:this.data.lk, id:this.data.itemsCreated, name:unit.data.name+" corpse", x:x, y:y, vis:{c:'%', fg:fg}});
			this.addItem(corpse);
			this.newItem();
			this.removeUnit(unit);
		}
		turn() {
			player.fov();
			player.turn();
			this.oblist.activeScreen.draw();
			this.display();
			if (player.data.delay === 0) return;
			let timeTaken = player.spendDelay();
			this.oblist.scheduler.setDuration(timeTaken);
			let actor = this.oblist.scheduler.next();
			while ( !actor.data.p ) {
				actor.turn();
				timeTaken = actor.spendDelay();
				this.oblist.scheduler.setDuration(timeTaken);
				actor = this.oblist.scheduler.next();
			}
		}
		othersInRange(x,y,r) {
			let units = [];
			for (let unit of this.oblist.currentLevelUnits) {
				let loc = unit.getLoc();
				if (Math.abs(loc[0]-x) <= r && Math.abs(loc[1]-y) <= r) {
					units.push(unit);
				}
			}
			return units;
		}
	// level code
		setLevel(level) {
			level.setParent(this);
			this.oblist.currentLevel = level;
		}
		newLevel() {
			this.data.levelsCreated++;
		}
		getInteraction(x,y,unit) {
			if (x === this.oblist.currentLevel.data.exit[0] && y === this.oblist.currentLevel.data.exit[1] && unit.data.p) {
				this.oblist.currentLevel = null;
				let inv = [];
				for (let item of this.oblist.currentLevelItems) {
					if (item.data.loc.owner === -1) {
						inv.push(item);
					}
				}
				this.oblist.currentLevelItems = inv;
				this.oblist.currentLevelUnits = [];
				this.oblist.scheduler.clear();
				this.data.lk++;
				Forger.prepareLevel({lk:this.data.lk});
				this.init();
				return 0;
			} else if (this.itemThere(x,y)) {
				unit.getItem();
				return 10;
			} /* else { 
				this.oblist.currentLevel.changeTile(x,y,0);
				return 30; //dig speed
			}*/
		}
		walkable(nx, ny) {
			return this.oblist.currentLevel.walkable(nx, ny);
		}
		movable(newX, newY, asker=null) {
			let unit = this.unitThere(newX, newY);
			let blocked = unit && unit !== asker;
			if (blocked) return false;
			return this.oblist.currentLevel.movable(newX, newY);
		}
		getValidPlacement() {
			return this.oblist.currentLevel.getValidPlacement();
		}
		getNeighbors(x,y,r,onlyWalkable=false){
			return this.oblist.currentLevel.getNeighbors(x,y,r,onlyWalkable);
		}
	// item code
		addItem(item) {
			item.setParent(this);
			this.oblist.currentLevelItems.push(item);
		}
		removeItem(item) {
			this.oblist.currentLevelItems.splice(this.oblist.currentLevelItems.indexOf(item),1);
		}
		newItem() {
			this.data.itemsCreated++;
		}
		itemThere(x, y, id) {
			let ilist = this.oblist.currentLevelItems;
			for (let item of ilist) {
				if (item.data.loc.x === x && item.data.loc.y === y && item.data.loc.owner === "floor") {
					return item;
				}
			}
			return false;
		}
		equip(item, unit) {
			let equipped = unit.equip(item);
			if (equipped) {
				item.equip(unit);
			}
			this.display();
		}
		unequip(item, unit) {
			unit.unequip(item);
			item.unequip(unit);
			this.display();
		}
		drop(item, unit) {
			item.drop(unit);
			this.display();
		}
		use(item, unit) {
			let sched = this.oblist.scheduler;
			let hp = unit.data.stats.mhp - unit.data.stats.chp;
			for (let use of item.data.usable) {
// 				let effect = {data:{p:false}};
// 				effect.spendDelay = x=>10;
				// check if it buffs/heals/hurts
				if (unit.data.stats[use.stat]) {
					unit.addBuff(use);
			}
			if (item.data.type === "consumable") {
				this.removeItem(item);
			}
			this.addMessage("You use the "+item.data.name+".");
			this.display();
		}
	}
	// UI
	switchScreen(newScreen = this.oblist.dscreen) {
		if (this.oblist.activeScreen) this.oblist.activeScreen.deactivate();
		if (this.oblist.activeScreen === newScreen) newScreen = this.oblist.dscreen;
		this.oblist.activeScreen = newScreen;
		this.oblist.activeScreen.activate();
	}
	display() {
		this.displayMessages();
		this.displayStatus();
		this.displayInventory();
	}
	addMessage(m) {
		this.data.messages.push([m, 0]);
		this.data.allMessagesHTML.innerHTML += m+'\n';
		this.display();
	}
	displayMessages() {
// 		this.data.messageHTML.innerHTML = '';
// 		for (let m of this.data.messages) {
// 			if (m[1] <= 5) {
// 				this.data.messageHTML.innerHTML += m[0];
// 				this.data.messageHTML.innerHTML += '\n';
// 			}
// 			m[1]++;
// 		}
	}
	displayStatus() {
		let hp = "HP: "+player.data.stats.chp+"/"+player.data.stats.mhp;
		let intimidation = "Intimidation: ???";
		let stealth = "Stealth: ???" ;
		let ac = '';//"AC: ["+player.getAC()+"]";
		let stam = "Stam: "+player.data.stats.cstam+"/"+player.data.stats.mstam;
		let melee = "Melee: "+player.getMelee()+"/"+player.data.stats.melee;
		let dmg = "Damage: ["+player.getDamage()+"]";
// 		let status = hp + " " + intimidation + " " + stealth + " " + stam + " " + melee + " " + dmg;
		let status = hp + " " + stam + " " + melee + " " + dmg;
		this.data.statusHTML.innerHTML = status;
	}
	displayInventory() {
		this.oblist.iscreen.draw();
	}
}
class Forger { // could refactor to interface with game or future db object
	static genLevel(lk) {
		levels[lk] = new Level({lk:lk, x:80, y:40});
	}
	static genItem(lk, data) {
		data.lk = lk;
		if ( !items[data.lk] ) items[data.lk] = [];
		[data.x, data.y] = levels[data.lk].getValidPlacement();
		let item = new Item(data);
		items[data.lk].push(item);
	}
	static genItems(lk) {
		let wealth = 10+lk*10;
		let validItems = Object.keys(itemTypes);
		let dcount = 0;
		let j = 0;
		while (dcount < wealth) {
			let i = randInt(0,validItems.length-1);
			let vitem = {...itemTypes[validItems[i]]};
			if (vitem.d[0] < wealth-dcount) {
				this.genItem(lk, vitem);
				dcount += vitem.d[0];
			}
			if (j>10000) { break; }
			j++;
		}
	}
	static genUnit(lk, data) {
		if ( !units[lk] ) units[lk] = [];
		let unit, ndata;
		ndata = {...data};
		[ndata.x, ndata.y] = levels[lk].getValidPlacement();
		let i = 0;
		while (Math.abs(ndata.x - player.data.x) < FOV || Math.abs(ndata.y - player.data.y) < FOV) {
			[ndata.x, ndata.y] = levels[lk].getValidPlacement();
			i++;
			if (i>50) { break; }
		}
		unit = new Unit(ndata);
		units[lk].push(unit);
	}
	static genUnits(lk) {
		let danger = 10+lk*10;
		let rareDenom = 0;
		let validUnits = {};
		for (let i in unitTypes) {
			let unit = unitTypes[i];
			if (lk >= unit.d[0] && lk <= unit.d[1]) {
				validUnits[unit.name] = unit;
				rareDenom += unit.d[2];
			}
		}
		let dcount = 0;
		let j = 0;
		while (dcount < danger) {
			for (let k in validUnits) {
				let vunit = validUnits[k];
				if (randInt(0,rareDenom) >= vunit.d[2]) {
					this.genUnit(lk, vunit);
					dcount += vunit.d[3];
				}
			}
			if (j>10000) { break; }
			j++;
		}
	}
	static prepareLevel(data) {
		units[data.lk] = [];
		items[data.lk] = [];
		this.genLevel(data.lk);
		this.genItems(data.lk);
		player.data.x = levels[data.lk].data.entrance[0];
		player.data.y = levels[data.lk].data.entrance[1];
		player.data.lk = data.lk;
		this.genUnits(data.lk);
	}
}
class Screen {
	constructor(data) {
		this.display = new ROT.Display({width:data.x, height:data.y});
		this.parent = data.parent;
		this.html = data.html;
		this.isActive = false;
		this.autoHide = data.autoHide;
		this.bindEventToScreen('keydown');
	}
	bindEventToScreen(event) {
		window.addEventListener(event, this.handleInput.bind(this));
	}
	activate() {
		this.isActive = true;
		this.html.appendChild(this.display.getContainer());
		this.html.style.visibility = "visible";
		if (this.parent.oblist.currentLevel) this.draw();
	}
	deactivate() {
		if (this.autoHide) {
			this.clear();
			this.html.style.visibility = "hidden";
		}
		this.isActive = false;
	}
	clear() {
		this.display.clear();
	}
}
class BattleScreen extends Screen {
	draw() {
		this.display.clear();
		let unit, item, x, y, c, fg;
		let tile;
		let level = this.parent.oblist.currentLevel;
		let dm = level.data.drawMap;
		let bg = {"AGGRESSIVE":"red", "HUNTING":"yellow", "WANDERING":"green"};
		for (let i=0; i<level.data.x; i++) {
			for (let j=0; j<level.data.y; j++) {
				this.display.draw(i, j, dm[i][j][0], "gray", dm[i][j][2]);
			}
		}
		for (let coords of player.data.fov) {
			this.display.draw(coords[0], coords[1], dm[coords[0]][coords[1]][0], dm[coords[0]][coords[1]][1], "white");
		}
		for (let unit of player.data.unitsInFov) {
			this.display.draw(unit.data.x, unit.data.y, unit.data.vis.c, unit.data.vis.fg, bg[unit.data.state]);
		}
		
		if (player.hasFlag("TELEPATHY")) {
			for (let unit of player.data.parent.oblist.currentLevelUnits) {
				this.display.draw(unit.data.x, unit.data.y, unit.data.vis.c, unit.data.vis.fg, unit.data.vis.bg);
			}
		}
		
		if (player.hasFlag("DEBUG")) {
			for (let unit of player.data.parent.oblist.currentLevelUnits) {
// 				for (let [x2,y2] of unit.data.path) {
// 					this.display.draw(x2, y2, "*", "purple", '');
// 				}
				this.display.draw(unit.data.goal[0], unit.data.goal[1], "$", "purple", player.data.vis.bg);
				this.display.draw(unit.data.x, unit.data.y, unit.data.vis.c, unit.data.vis.fg, bg[unit.data.state]);
			}
		}
		
		this.display.draw(player.data.x, player.data.y, player.data.vis.c, "white", player.data.vis.bg);
	}
	handleInput(e) {
		if ( !this.isActive ) return;
		let intended = true; // replace with scheduler check
		if (e.type === 'keydown') {
			if (keys.right.includes(e.key)) player.move(1,0);
			else if (keys.left.includes(e.key)) player.move(-1,0);
			else if (keys.up.includes(e.key)) player.move(0,-1);
			else if (keys.down.includes(e.key)) player.move(0,1);
			else if (keys.downRight.includes(e.key)) player.move(1,1);
			else if (keys.downLeft.includes(e.key)) player.move(-1,1);
			else if (keys.upRight.includes(e.key)) player.move(1,-1);
			else if (keys.upLeft.includes(e.key)) player.move(-1,-1);
			else if (keys.wait.includes(e.key)) {
				intended = true;
				player.regenStamina();
			}
			else if (e.key === "g") player.delay(player.getItem());
			else if (e.key === "t") player.delay(player.interact());
			else if (e.key === "i") this.parent.switchScreen(this.parent.oblist.iscreen);
			else intended = false;
		}
		if (intended) {
			e.preventDefault();
			this.parent.turn();
		}
	}
}
class InventoryScreen extends Screen {
	draw() {
		this.html.innerHTML = '';
		let gear = document.createElement("div");
		gear.id = "igear";
		this.html.appendChild(gear);
		this.drawGear();
		let item = document.createElement("div");
		item.id = "iitem";
		this.html.appendChild(item);
		this.drawInv();
	}
	drawGear() {
		let g = this.parent;
		document.getElementById("igear").innerHTML = '';
		let etxt = document.createElement("p");
		etxt.innerHTML = "Equipment: \n";
		document.getElementById("igear").appendChild(etxt);
		let btn1;
		let gear = [];
		for (let item of this.parent.oblist.currentLevelItems) {
			if (item.data.loc.owner === -1 && item.data.equipped) {
				gear.push(item);
			}
		}
		gear = player.data.equipment;
		for (let i in gear) {
			let slot = gear[i];
			if (slot.data) {
				let slotHolder = document.createElement("span");
				slotHolder.innerHTML = slot.data.slot + ": " + slot.data.name;

				btn1 = document.createElement("BUTTON");
				btn1.innerHTML = "remove";
				btn1.classList.add("inventoryButton");
				btn1.onclick = function() {
					g.unequip(slot,player);
				}
				slotHolder.appendChild(btn1);

				slotHolder.innerHTML += "<br />";
				document.getElementById("igear").appendChild(slotHolder);
			}
		}
	}
	drawInv() {
		let g = this.parent;
		document.getElementById("iitem").innerHTML = '';
		let txt = document.createElement("p");
		txt.innerHTML = "Inventory: \n";
		document.getElementById("iitem").appendChild(txt);
		let inv = [];
		for (let i in this.parent.oblist.currentLevelItems) {
			let item = this.parent.oblist.currentLevelItems[i];
			if (item.data.loc.owner === -1 && !item.equipped) {
				inv.push(i*1);
			}
		}
		let btn1, btn2, btn3;
		for (let i of inv) {
			let item = this.parent.oblist.currentLevelItems[i];
			let itemHolder = document.createElement("span")
			itemHolder.innerHTML = item.data.name + ": ";
			itemHolder.classList.add("buttonRow");
			
			if (item.data.equippable) {
				btn2 = document.createElement("BUTTON");
				btn2.onclick = function() {
					g.equip(g.oblist.currentLevelItems[i], player);
				}
				btn2.innerHTML = "equip";
				btn2.classList.add("inventoryButton");
				itemHolder.appendChild(btn2);
			}
			if (item.data.usable) {
				if (item.data.usable[0]) {
					btn3 = document.createElement("BUTTON");
					btn3.onclick = function() {
						g.use(g.oblist.currentLevelItems[i], player);
					}
					btn3.innerHTML = "use";
					btn3.classList.add("inventoryButton");
					itemHolder.appendChild(btn3);
				}
			}
			
			btn1 = document.createElement("BUTTON");
			btn1.onclick = function() {
				g.drop(g.oblist.currentLevelItems[i],player);
			}
			btn1.innerHTML = "drop";
			btn1.classList.add("inventoryButton");
			itemHolder.appendChild(btn1);
			
			document.getElementById("iitem").appendChild(itemHolder);
			// throw
		}
	}
	handleInput(e) {
		if ( !this.isActive ) return;
		let intended = true; // replace with scheduler check
		if (e.type === 'keydown') {
			if (e.keyCode === ROT.KEYS.VK_RIGHT || e.key === "d") this.moveSelector(1,0);
			else if (e.keyCode === ROT.KEYS.VK_LEFT || e.key === "a") this.moveSelector(-1,0);
			else if (e.keyCode === ROT.KEYS.VK_UP || e.key === "w") this.moveSelector(0,-1);
			else if (e.keyCode === ROT.KEYS.VK_DOWN || e.key === "s") this.moveSelector(0,1);
			else if (e.key === "Escape") this.parent.switchScreen(this.parent.oblist.dscreen);
			else intended = false;
			this.draw();
		}
	}
}
var levels = {};
var units = {};
var items = {};
var keys = {
	left: ["a", "h", "ArrowLeft"],
	right: ["d", "l", "ArrowRight"],
	up: ["w", "k", "ArrowUp"],
	down: ["s", "j", "ArrowDown"],
	upLeft: ['q', 'y', "Home"],
	upRight: ['e', 'u', "PageUp"],
	downLeft: ['z', 'b', "End"],
	downRight: ['c', 'n', "PageDown"],
	wait: ['x', '.', "Unidentified"] // probably not good
}
var unitTypes = {
	troll:{name:"troll", vis:{c:"T", fg: "green"}, stats: {mhp:20, chp:20, mstam:8, cstam:8, melee:2, str:10, res:5, move:1}, flags:[], slots: {...humanoid}, d:[3,5,1,6,6]}, // d:[min depth, max depth, commonness (lower = rarer), danger level (higher = more dangerous), exp for kiling]
	orc:{name: "orc", vis:{c:"o", fg: "brown"}, stats: {mhp:8, chp:8, mstam:8, cstam:8, melee:3, str:5, res:2, move:1}, flags:[], slots: {...humanoid}, d:[0,4,4,1,1]}
};
var itemTypes = {
	hpPotion:{name:'health potion', vis:{c:'!', fg:"red"}, equippable: false, type:"consumable", usable: [{stat:'chp', percentage:false, amount:10, everyTurn:false, ends:true, endsAfter:1, permanent:true}], d:[1]},
	regenPotion:{name:'regen potion', vis:{c:'!', fg:"pink"}, equippable: false, type:"consumable", usable: [{stat:'chp', percentage:false, amount:1, everyTurn:true, ends:true, endsAfter:10, permanent:true}], d:[1]},
	poisonPotion:{name:'poison potion', vis:{c:'!', fg:"green"}, equippable: false, type:"consumable", usable: [{stat:'chp', percentage:false, amount:-1, everyTurn:true, ends:true, endsAfter:10, permanent:true}], d:[1]},
	strengthPotion:{name:'strength potion', vis:{c:'!', fg:"white"}, equippable: false, type:"consumable", usable: [{stat:'str', percentage:false, amount:5, everyTurn:false, ends:true, endsAfter:10, permanent:false}], d:[1]},
	resiliencePotion:{name:'resilience potion', vis:{c:'!', fg:"white"}, equippable: false, type:"consumable", usable: [{stat:'res', percentage:false, amount:5, everyTurn:false, ends:true, endsAfter:10, permanent:false}], d:[1]},
	
// 	mhpPotion:{name:'vitality potion', vis:{c:'!', fg:"red"}, equippable: false, type:"consumable", usable: [{stat:'mhp', percentage:false, amount:10, everyTurn:false, ends:true, endsAfter:10, permanent:false},
// 	{stat:'chp', percentage:false, amount:10, everyTurn:false, ends:true, endsAfter:10, permanent:false}],
// 	d:[1]},
	
	helm:{name: "helm", dice:1, sides:2, vis:{c:']', fg:"grey"}, equippable: true, type:"armor", slot:"head", usable: [], d:[1]},
	mailHauberk:{name: "mail hauberk", dice:1, sides:2, vis:{c:']', fg:"grey"}, equippable: true, type:"armor", slot:"torso", usable: [], d:[1]},
	gauntlets:{name: "gauntlet", dice:1, sides:2, vis:{c:']', fg:"grey"}, equippable: true, type:"armor", slot:"hand", usable: [], d:[1]},
	sabatons:{name: "sabaton", dice:1, sides:2, vis:{c:']', fg:"grey"}, equippable: true, type:"armor", slot:"foot", usable: [], d:[1]},
	sword:{name: "sword", dice:2, sides:6, vis:{c:'/', fg:"grey"}, equippable: true, type:"weapon", slot:"grasp", usable: [], d:[1]}
}
var tileTypes = {
	1: {
		bools: {w:false, s:false}, 
		vis: {c:'#', fg:"gray", bg:''}
	}, 
	0: {
		bools: {w:true, s:true},
		vis: {c:'.', fg:'gray', bg:''}
	},
	entrance: {
		bools: {w:true, s:true},
		vis: {c:'<', fg:'gray', bg:''}
	},
	exit: {
		bools: {w:true, s:true},
		vis: {c:'>', fg:'gray', bg:''}
	}
}
// usage: numpad[dx][dy] = directional key for movement
var numpad = {'-1':{'-1':1, '0':4, '1':7}, '0':{'-1':2, '0':5, '1':8}, '1':{'-1':3, '0':6, '1':9}};
var reverseNumpad = {'1': [-1,-1], '2': [0,-1], '3': [1,-1], '4': [-1,0], '5': [0,0], '6': [1,0], '7': [-1,1], '8': [0,1], '9': [1,1], }
// copied directly from sil
var moveBias = [
	[ 0, 0, 0, 0, 0, 0, 0, 0 ],	/* bias right */
	[ 1, 4, 2, 7, 3, 8, 6, 9 ],
	[ 2, 1, 3, 4, 6, 7, 9, 8 ],
	[ 3, 2, 6, 1, 9, 4, 8, 7 ],
	[ 4, 7, 1, 8, 2, 9, 3, 6 ],
	[ 5, 5, 5, 5, 5, 5, 5, 5 ],
	[ 6, 3, 9, 2, 8, 1, 7, 4 ],
	[ 7, 8, 4, 9, 1, 6, 2, 3 ],
	[ 8, 9, 7, 6, 4, 3, 1, 2 ],
	[ 9, 6, 8, 3, 7, 2, 4, 1 ],

	[ 0, 0, 0, 0, 0, 0, 0, 0 ],	/* bias left */
	[ 1, 2, 4, 3, 7, 6, 8, 9 ],
	[ 2, 3, 1, 6, 4, 9, 7, 8 ],
	[ 3, 6, 2, 9, 1, 8, 4, 7 ],
	[ 4, 1, 7, 2, 8, 3, 9, 6 ],
	[ 5, 5, 5, 5, 5, 5, 5, 5 ],
	[ 6, 9, 3, 8, 2, 7, 1, 4 ],
	[ 7, 4, 8, 1, 9, 2, 6, 3 ],
	[ 8, 7, 9, 4, 6, 1, 3, 2 ],
	[ 9, 8, 6, 7, 3, 4, 2, 1 ]
];
let x = 80;
let y = 40;
var canvas = document.getElementById("game");
Forger.prepareLevel({lk:0});
var game = new Game(x, y, {lk: 0, html:canvas});
game.newGame();

document.getElementById("inv-show").onclick = function () {
	game.switchScreen(game.oblist.iscreen);
}
document.getElementById("get-item").onclick = function () {
	player.interact();
}
document.getElementById("interact").onclick = function () {
	player.getItem();
}
document.getElementById("ng").onclick = function () {
	game.killPlayer();
}
function moveButton(x,y) { player.move(x,y); game.turn(); }
document.getElementById("left").onclick = function () { moveButton(-1,0) }
document.getElementById("right").onclick = function () { moveButton(1,0) }
document.getElementById("up").onclick = function () { moveButton(0,-1) }
document.getElementById("down").onclick = function () { moveButton(0,1) }
document.getElementById("top-left").onclick = function () { moveButton(-1,-1) }
document.getElementById("top-right").onclick = function () { moveButton(1,-1) }
document.getElementById("bottom-left").onclick = function () { moveButton(-1,1) }
document.getElementById("bottom-right").onclick = function () { moveButton(1,1) }
document.getElementById("not-game").style.width = document.getElementById("game").offsetWidth;
document.getElementById("messages-all").style.height = document.getElementById("msg-holder").offsetHeight-document.getElementById("hp").offsetHeight;
