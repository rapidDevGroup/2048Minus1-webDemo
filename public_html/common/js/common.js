// Initialize your app
var myApp = new Framework7({
    fastClicksDistanceThreshold : 20,
    animateNavBackIcon: true
});
// Export selectors engine
var $$ = Dom7;
// Add views
var leftView = myApp.addView('.view-left', {
    // Because we use fixed-through navbar we can enable dynamic navbar
    dynamicNavbar: true
});
var mainView = myApp.addView('.view-main', {
    // Because we use fixed-through navbar we can enable dynamic navbar
    dynamicNavbar: true
});

var debug = false;
var score = 0;
var highScore = 0;
var scoreDraw, highScoreDraw;
var undoRemaining = 5;
var animationSpeed = 130;
var difficulty = $$('input[name="my-level"]:checked').val();
var animationType = createjs.Ease.linear;
var gameCanvas = $$('#gameCanvas');
var width = $$('.view-main').outerWidth();
var height = $$('.view-main').outerHeight() - $$('.navbar').outerHeight();
var stage;
var heightSmall;
var centerX, centerY;
var startX, startY;
var boardPos = [[[0,0],[0,0],[0,0],[0,0]],[[0,0],[0,0],[0,0],[0,0]],[[0,0],[0,0],[0,0],[0,0]],[[0,0],[0,0],[0,0],[0,0]]];
var valueBackgroundColor = ['#bbada0', '#eee4da','#ede0c8', '#f2b179', '#ec8d54', '#f67c5f', '#ea5937', '#f3d86b', '#f1d04b', '#e4c02a', '#e2ba13', '#ecc400', '#ecc400', '#ecc400', '#ecc400', '#ecc400', '#ecc400']; // 2048 is the last one
var valueTextColor = ['#bbada0','#776e65', '#776e65', '#fff', '#fff', '#fff', '#fff', '#fff', '#fff', '#fff', '#fff', '#fff', '#fff', '#fff', '#fff', '#fff', '#fff'];
var gameBoardValue = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
var gameScoreHistory = [];
var gameBoardHistory = [];
var gameBoardSquares = [[],[],[],[]];
var gameBoardBlocked = [[false, false, false, false],[false, false, false, false],[false, false, false, false],[false, false, false, false]];
var gameBoardSize;
var gameBoardPadding;
var gameSquareSize;
var gameSquarePadding;
var scoreBoard, undoButton;
var boardMessage;
var running = false;

$$('html').addClass('with-statusbar-overlay');
Pace.on('done', loaded);
window.addEventListener("orientationchange", refresh, false);
window.addEventListener("resize", refresh, false);

function loaded() {
    init();

    $$('#random').on('click', randomizeBoard);
    $$('#undo').on('click', undo);
    $$('#undoButton').on('click', undo);
    $$('#new-game').on('click', newGame);
    $$('input[name="my-level"]').on('change', changeDifficulty);

    createjs.Sound.registerSound("res/sounds/combine.ogg", "combine");
    createjs.Sound.registerSound("res/sounds/nocombine.ogg", "nocombine");
    createjs.Sound.registerSound("res/sounds/gameover.wav", "gameover");
}
function calculateSize() {
    width = $$('.view-main').outerWidth();
    height = ($$('.view-main').outerHeight() - $$('#main-nav').outerHeight());

    gameCanvas.attr('width', width).attr('height', height);

    heightSmall = (width > height);
    centerX = width/2;
    centerY = height/2;
    gameBoardPadding = Math.round(heightSmall ? height*.1/2 : width *.1/2);
    gameBoardSize = (heightSmall ? height: width ) - 2 * gameBoardPadding;
    if ($$('.hide-as-menu').css('display') == 'none') {
        if (heightSmall) {
            startX = width - gameBoardSize - gameBoardPadding;
            startY = centerY - gameBoardSize / 2;
        } else {
            startX = centerX - gameBoardSize / 2;
            startY = height - gameBoardSize - gameBoardPadding;
        }
    } else {
        startX = centerX - gameBoardSize / 2;
        startY = centerY - gameBoardSize / 2;
    }
    gameSquarePadding = Math.round(gameBoardSize *.02);
    gameSquareSize = (gameBoardSize - gameSquarePadding*5)/4;
}
function refresh() {
    stage.removeAllChildren();
    calculateSize();
    setGameBoard();
    drawBoard();
    drawScore();
}
function init() {
    calculateSize();

    var gameCanvasActions = new Hammer(gameCanvas[0]);
    gameCanvasActions.get('pan').set({ direction: Hammer.DIRECTION_ALL});
    gameCanvasActions.get('pan').set({ threshold: 20});
    gameCanvasActions.on("panend", function(e) {
        saveHistory();
        if (debug) consoleLogGameBoard();
        var moveSuccessful = false;
        if(e.direction == Hammer.DIRECTION_RIGHT) {
            moveSuccessful = gameRight();
        } else if (e.direction == Hammer.DIRECTION_LEFT) {
            moveSuccessful = gameLeft();
        } else if (e.direction == Hammer.DIRECTION_DOWN) {
            moveSuccessful = gameDown();
        } else if (e.direction == Hammer.DIRECTION_UP) {
            moveSuccessful = gameUp();
        }
        if (!moveSuccessful) gameBoardHistory.pop();
        drawScore();
        if (checkBoardFull()) {
            // end game
            clearMemory();
            gameOverMessage();
            if (debug) console.log("Game Over");
        }
    });

    stage = new createjs.Stage("gameCanvas");

    var savedHighScore = localStorage.getItem("highScore");
    if (savedHighScore) highScore = parseInt(savedHighScore, 10);
    var savedUndoRemaining = localStorage.getItem("undoRemaining");
    if (savedUndoRemaining) undoRemaining = parseInt(savedUndoRemaining, 10);

    var saved = JSON.parse(localStorage.getItem("gameBoardValue"));
    if (saved){
        gameBoardValue = saved;
        score = parseInt(localStorage.getItem("score"), 10);
        setGameBoard();
        drawBoard();
        drawScore();
    } else {
        clearAll();
        setGameBoard();
        intro();
    }
    createjs.Ticker.setFPS(60);
    createjs.Ticker.addEventListener("tick", stage);
}
function drawScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem("highScore", highScore);
    }
    $$('#current-score').text(formatNumber(score));
    $$('#high-score').text(formatNumber(highScore));
    $$('#undo-remaining').text(undoRemaining);
    $$('#undo-remaining2').text(undoRemaining);
    if ($$('.hide-as-menu').css('display') == 'none') {
        var scoreBoxWidth, scoreBoxHeight, textWidth, textHeight, textSize;
        if (!heightSmall && width != height) {
            scoreBoxWidth = (width - gameBoardPadding * 3) / 2;
            scoreBoxHeight = (height - gameBoardSize - gameBoardPadding * 3) / 2;

            textSize = scoreBoxWidth / 4;
            if (scoreDraw) stage.removeChild(scoreDraw);
            scoreDraw = new createjs.Text(formatNumber(score), textSize + "px capture_itregular", "#776e65");
            textWidth = scoreDraw.getMeasuredWidth();
            textHeight = scoreDraw.getMeasuredHeight();
            scoreDraw.x = gameBoardPadding + scoreBoxWidth / 2 - textWidth / 2;
            scoreDraw.y = gameBoardPadding + scoreBoxHeight / 2 - textHeight / 2;
            stage.addChild(scoreDraw);

            if (highScoreDraw) stage.removeChild(highScoreDraw);
            highScoreDraw = new createjs.Text(formatNumber(highScore), textSize + "px capture_itregular", "#776e65");
            textWidth = highScoreDraw.getMeasuredWidth();
            textHeight = highScoreDraw.getMeasuredHeight();
            highScoreDraw.x = gameBoardPadding * 2 + scoreBoxWidth + scoreBoxWidth / 2 - textWidth / 2;
            highScoreDraw.y = gameBoardPadding + scoreBoxHeight / 2 - textHeight / 2;
            stage.addChild(highScoreDraw);

        } else if (heightSmall && width != height) {
            scoreBoxWidth = (width - gameBoardSize - gameBoardPadding * 3);
            scoreBoxHeight = (height / 2 - gameBoardPadding * 3) / 2;

            textSize = scoreBoxWidth / 5;
            if (scoreDraw) stage.removeChild(scoreDraw);
            scoreDraw = new createjs.Text(formatNumber(score), textSize + "px capture_itregular", "#776e65");
            textWidth = scoreDraw.getMeasuredWidth();
            textHeight = scoreDraw.getMeasuredHeight();
            scoreDraw.x = gameBoardPadding + scoreBoxWidth / 2 - textWidth / 2;
            scoreDraw.y = gameBoardPadding * 2 + scoreBoxHeight / 2 - textHeight / 2;
            stage.addChild(scoreDraw);

            if (highScoreDraw) stage.removeChild(highScoreDraw);
            highScoreDraw = new createjs.Text(formatNumber(highScore), textSize + "px capture_itregular", "#776e65");
            textWidth = highScoreDraw.getMeasuredWidth();
            textHeight = highScoreDraw.getMeasuredHeight();
            highScoreDraw.x = gameBoardPadding + scoreBoxWidth / 2 - textWidth / 2;
            highScoreDraw.y = gameBoardPadding * 4 + scoreBoxHeight + scoreBoxHeight / 2 - textHeight / 2 + gameBoardPadding / 2;
            stage.addChild(highScoreDraw);

        }
    }
}
function gameOverMessage() {
    boardMessage = new createjs.Container();
    var messageSize = gameBoardSize - gameSquarePadding*2;

    var messageSquare = new createjs.Shape();
    messageSquare.graphics.beginFill("#000").drawRoundRect(
        startX + gameSquarePadding, startY + gameSquarePadding,
        messageSize, messageSize,
        gameBoardSize *.01, gameBoardSize *.01, gameBoardSize *.01, gameBoardSize *.01);

    boardMessage.addChild(messageSquare);

    var fontSize = (gameBoardSize - gameBoardPadding/2)/6;
    var text = new createjs.Text("Game Over!", fontSize + "px capture_itregular", "#fff");
    var textWidth = text.getMeasuredWidth();
    var textHeight = text.getMeasuredHeight();
    text.x = startX + gameBoardSize/2 - textWidth/2;
    text.y = startY + gameBoardSize/2 - textHeight/2;

    boardMessage.addChild(text);

    boardMessage.x = startX + gameBoardSize/2;
    boardMessage.y = startY + gameBoardSize/2;
    boardMessage.scaleX = 0;
    boardMessage.scaleY = 0;
    boardMessage.alpha = 0;

    stage.addChild(boardMessage);

    createjs.Tween.get(boardMessage, {override: false, loop: false}).wait(animationSpeed*5).to({
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        alpha: 0.7
    }, animationSpeed*20, createjs.Ease.elasticOut).call(function(){
        if ($$('#sound-on').prop("checked")) createjs.Sound.play('gameover');
    });
}
function intro() {
    boardMessage = new createjs.Container();
    var messageSize = gameBoardSize - gameSquarePadding*2;

    var messageSquare = new createjs.Shape();
    messageSquare.graphics.beginFill("#000").drawRoundRect(
        startX + gameSquarePadding, startY + gameSquarePadding,
        messageSize, messageSize,
        gameBoardSize *.01, gameBoardSize *.01, gameBoardSize *.01, gameBoardSize *.01);

    boardMessage.addChild(messageSquare);

    var fontSize = (gameBoardSize - gameBoardPadding/2)/12;
    var text = new createjs.Text("Swipe Numbers\nTogether", fontSize + "px capture_itregular", "#fff");
    text.textAlign = "center";
    var textWidth = text.getMeasuredWidth();
    var textHeight = text.getMeasuredHeight();
    text.x = startX + textWidth/2;
    text.y = startY + gameBoardSize/2 - textHeight/2;

    var text2 = new createjs.Text("Swipe In All\nDirections", fontSize + "px capture_itregular", "#fff");
    text2.textAlign = "center";
    textWidth = text2.getMeasuredWidth();
    textHeight = text2.getMeasuredHeight();
    text2.x = startX + textWidth/2;
    text2.y = startY + gameBoardSize/2 - textHeight/2;
    text2.alpha = 0;

    var text3 = new createjs.Text("Goal is to Get\na 2048 Block\nor Bigger", fontSize + "px capture_itregular", "#fff");
    text3.textAlign = "center";
    textWidth = text3.getMeasuredWidth();
    textHeight = text3.getMeasuredHeight();
    text3.x = startX + textWidth/3;
    text3.y = startY + gameBoardSize/2 - textHeight/2;
    text3.alpha = 0;

    var text4 = new createjs.Text("Let's Play", fontSize + "px capture_itregular", "#fff");
    textWidth = text4.getMeasuredWidth();
    textHeight = text4.getMeasuredHeight();
    text4.x = startX + gameBoardSize/2 - textWidth/2;
    text4.y = startY + gameBoardSize/2 - textHeight/2;
    text4.alpha = 0;

    boardMessage.addChild(text);
    boardMessage.addChild(text2);
    boardMessage.addChild(text3);
    boardMessage.addChild(text4);

    stage.addChild(boardMessage);

    createSquare(1, 2, 3);
    createjs.Tween.get(gameBoardSquares[2][3], {override: false, loop: false}).to({
        x: boardPos[2][3][0],
        y: boardPos[2][3][1],
        alpha: 1,
        scaleX: 1,
        scaleY: 1
    }, animationSpeed, animationType);

    createSquare(1, 1, 3);
    createjs.Tween.get(gameBoardSquares[1][3], {override: false, loop: false}).to({
        x: boardPos[1][3][0],
        y: boardPos[1][3][1],
        alpha: 1,
        scaleX: 1,
        scaleY: 1
    }, animationSpeed, animationType);

    setTimeout(function(){
        for (var y = 3; y >= 0; y--) {
            for (var x = 3; x >= 0; x--) {
                //console.log("x: " + x + " y: " + y);
                if (gameBoardValue[x][y] !== 0) {
                    var moveX = getRight(x, y);

                    if (combineRight(x,y)) {
                        move = true;
                        moveX++;
                        combineMain(x, y, x+moveX, y);

                    } else if (gameBoardValue[x + moveX][y] === 0 && moveX !== 0) {
                        move = true;
                        moveMain(x, y, x+moveX, y);
                    }
                }
            }
        }
    }, 3000);

    createjs.Tween.get(text, {override: true, loop: false}).wait(2000).to({
        alpha: 0
    }, 1000, animationType).call(function(){ boardMessage.removeChild(this); });

    createjs.Tween.get(text2, {override: true, loop: false}).wait(4000).to({
        alpha: 1
    }, 1000, animationType).wait(2000).to({
        alpha: 0
    }, 1000, animationType).call(function(){ boardMessage.removeChild(this); });

    createjs.Tween.get(text3, {override: true, loop: false}).wait(9000).to({
        alpha: 1
    }, 1000, animationType).wait(2000).to({
        alpha: 0
    }, 1000, animationType).call(function(){ boardMessage.removeChild(this); });

    createjs.Tween.get(text4, {override: true, loop: false}).wait(13000).to({
        alpha: 1
    }, 1000, animationType).wait(2000).to({
        alpha: 0
    }, 1000, animationType).call(function(){ boardMessage.removeChild(this); });

    setTimeout(function(){
        for (var y = 3; y >= 0; y--) {
            for (var x = 3; x >= 0; x--) {
                //console.log("x: " + x + " y: " + y);
                if (gameBoardValue[x][y] !== 0) {
                    createjs.Tween.get(gameBoardSquares[x][y], {override: false, loop: false}).to({
                        alpha: 0,
                        scaleX: 0,
                        scaleY: 0
                    }, animationSpeed, animationType);
                }
            }
        }
    }, 5000);

    createjs.Tween.get(boardMessage, {override: true, loop: false}).wait(17000).to({
        alpha: 0
    }, animationSpeed, animationType).call(function(){ stage.removeChild(this); newGame(); });
}
function newUndoMessage() {
    setTimeout(function() {
        var newUndoMessage = new createjs.Container();
        var messageSize = gameBoardSize - gameSquarePadding * 2;

        var messageSquare = new createjs.Shape();
        messageSquare.graphics.beginFill("#000").drawRoundRect(
            startX + gameSquarePadding, startY + gameSquarePadding,
            messageSize, messageSize,
            gameBoardSize * .01, gameBoardSize * .01, gameBoardSize * .01, gameBoardSize * .01);

        newUndoMessage.addChild(messageSquare);

        var fontSize = (gameBoardSize - gameBoardPadding / 2) / 6;
        var text = new createjs.Text("+ Undo!", fontSize + "px capture_itregular", "#fff");
        var textWidth = text.getMeasuredWidth();
        var textHeight = text.getMeasuredHeight();
        text.x = startX + gameBoardSize / 2 - textWidth / 2;
        text.y = startY + gameBoardSize / 2 - textHeight / 2;

        newUndoMessage.addChild(text);

        newUndoMessage.x = startX + gameBoardSize / 2;
        newUndoMessage.y = startY + gameBoardSize / 2;
        newUndoMessage.scaleX = 0;
        newUndoMessage.scaleY = 0;
        newUndoMessage.alpha = 0;

        stage.addChild(newUndoMessage);

        createjs.Tween
            .get(newUndoMessage, {override: false, loop: false})
            .to({
                x: 0,
                y: 0,
                scaleX: 1,
                scaleY: 1,
                alpha: 0.3
            }, animationSpeed * 2, animationType)
            .to({
                x: -(startX + gameBoardSize / 2),
                y: -(startY + gameBoardSize / 2),
                scaleX: 2,
                scaleY: 2,
                alpha: 0
            }, animationSpeed * 2, animationType)
            .call(function () {
                stage.removeChild(this);
            });
    }, animationSpeed);
}
function changeDifficulty() {
    myApp.confirm('Are you sure you want to start a new game?', 'New Game?',
        function () {
            difficulty = $$('input[name="my-level"]:checked').val();
            newGame();
            myApp.closePanel();
        },
        function () {
            $$('input[value="' + difficulty + '"]').prop('checked', true);
        }
    );
}
function setGameBoard() {
    var scoreBoxWidth, scoreBoxHeight, textWidth, textHeight, scoreSquare, scoreSquare2, scoreTitle, highScoreTitle;
    if ($$('.hide-as-menu').css('display') == 'none') {
        if (!heightSmall && width != height) {
            scoreBoard = new createjs.Container();
            scoreBoxWidth = (width - gameBoardPadding * 3) / 2;
            scoreBoxHeight = (height - gameBoardSize - gameBoardPadding * 3) / 2;

            scoreSquare = new createjs.Shape();
            scoreSquare.graphics.beginFill("#ccc0b4").drawRoundRect(
                gameBoardPadding, gameBoardPadding,
                scoreBoxWidth, scoreBoxHeight,
                scoreBoxWidth * .04, scoreBoxWidth * .04, scoreBoxWidth * .04, scoreBoxWidth * .04);
            scoreSquare.cache(gameBoardPadding, gameBoardPadding, scoreBoxWidth, scoreBoxHeight);
            scoreBoard.addChild(scoreSquare);

            scoreTitle = new createjs.Text("Score", gameBoardPadding * .9 + "px capture_itregular", "#ccc0b4");
            textHeight = scoreTitle.getMeasuredHeight();
            textWidth = scoreTitle.getMeasuredWidth();
            scoreTitle.x = gameBoardPadding;
            scoreTitle.y = gameBoardPadding - textHeight;
            scoreTitle.cache(0, 0, textWidth, textHeight);
            scoreBoard.addChild(scoreTitle);

            scoreSquare2 = new createjs.Shape();
            scoreSquare2.graphics.beginFill("#ccc0b4").drawRoundRect(
                gameBoardPadding * 2 + scoreBoxWidth, gameBoardPadding,
                scoreBoxWidth, scoreBoxHeight,
                scoreBoxWidth * .04, scoreBoxWidth * .04, scoreBoxWidth * .04, scoreBoxWidth * .04);
            scoreSquare2.cache(gameBoardPadding * 2 + scoreBoxWidth, gameBoardPadding, scoreBoxWidth, scoreBoxHeight);
            scoreBoard.addChild(scoreSquare2);

            highScoreTitle = new createjs.Text("High Score", gameBoardPadding * .9 + "px capture_itregular", "#ccc0b4");
            textHeight = highScoreTitle.getMeasuredHeight();
            textWidth = highScoreTitle.getMeasuredWidth();
            highScoreTitle.x = gameBoardPadding * 2 + scoreBoxWidth;
            highScoreTitle.y = gameBoardPadding - textHeight;
            highScoreTitle.cache(0, 0, textWidth, textHeight);
            scoreBoard.addChild(highScoreTitle);

            $$('#undoButton').css('top', $$('#main-nav').outerHeight() + gameBoardPadding*1.5 + scoreBoxHeight + 'px');
            $$('#undoButton').css('left', '0');
            $$('#undoButton').css('line-height', scoreBoxHeight + 'px');
            $$('#undoButton').css('width', '100%');
            $$('#undoButton').css('height', scoreBoxHeight + 'px');
            $$('#undoButton').css('font-size', gameBoardPadding * 1.8 + 'px');

            stage.addChild(scoreBoard);
        } else if (heightSmall && width != height) {
            scoreBoard = new createjs.Container();
            scoreBoxWidth = (width - gameBoardSize - gameBoardPadding * 3);
            scoreBoxHeight = (height / 2 - gameBoardPadding * 2) / 2;

            scoreSquare = new createjs.Shape();
            scoreSquare.graphics.beginFill("#ccc0b4").drawRoundRect(
                gameBoardPadding, gameBoardPadding * 2,
                scoreBoxWidth, scoreBoxHeight,
                scoreBoxWidth * .04, scoreBoxWidth * .04, scoreBoxWidth * .04, scoreBoxWidth * .04);
            scoreSquare.cache(gameBoardPadding, gameBoardPadding * 2, scoreBoxWidth, scoreBoxHeight);
            scoreBoard.addChild(scoreSquare);

            scoreTitle = new createjs.Text("Score", gameBoardPadding * .9 + "px capture_itregular", "#ccc0b4");
            textHeight = scoreTitle.getMeasuredHeight();
            textWidth = scoreTitle.getMeasuredWidth();
            scoreTitle.x = gameBoardPadding;
            scoreTitle.y = gameBoardPadding * 2 - textHeight;
            scoreTitle.cache(0, 0, textWidth, textHeight);
            scoreBoard.addChild(scoreTitle);

            scoreSquare2 = new createjs.Shape();
            scoreSquare2.graphics.beginFill("#ccc0b4").drawRoundRect(
                gameBoardPadding, gameBoardPadding * 4 + scoreBoxHeight,
                scoreBoxWidth, scoreBoxHeight,
                scoreBoxWidth * .04, scoreBoxWidth * .04, scoreBoxWidth * .04, scoreBoxWidth * .04);
            scoreSquare2.cache(gameBoardPadding, gameBoardPadding * 4 + scoreBoxHeight, scoreBoxWidth, scoreBoxHeight);
            scoreBoard.addChild(scoreSquare2);

            highScoreTitle = new createjs.Text("High Score", gameBoardPadding * .9 + "px capture_itregular", "#ccc0b4");
            textHeight = highScoreTitle.getMeasuredHeight();
            textWidth = highScoreTitle.getMeasuredWidth();
            highScoreTitle.x = gameBoardPadding;
            highScoreTitle.y = gameBoardPadding * 4 + scoreBoxHeight - textHeight;
            highScoreTitle.cache(0, 0, textWidth, textHeight);
            scoreBoard.addChild(highScoreTitle);

            $$('#undoButton').css('top', $$('#main-nav').outerHeight() + gameBoardPadding * 5.5 + scoreBoxHeight * 2 + 'px');
            $$('#undoButton').css('left', gameBoardPadding + 'px');
            $$('#undoButton').css('line-height', scoreBoxHeight + 'px');
            $$('#undoButton').css('width', scoreBoxWidth + 'px');
            $$('#undoButton').css('height', scoreBoxHeight + 'px');
            $$('#undoButton').css('font-size', gameBoardPadding * 1.8 + 'px');

            stage.addChild(scoreBoard);
        }
    } else {
        if (scoreBoard) stage.removeChild(scoreBoard);
    }

    var square = new createjs.Shape();
    square.graphics.beginFill("#ccc0b4").drawRoundRect(
        startX, startY,
        gameBoardSize, gameBoardSize,
        gameBoardSize *.02, gameBoardSize *.02, gameBoardSize *.02, gameBoardSize *.02);
    square.cache(startX, startY, gameBoardSize, gameBoardSize);
    stage.addChild(square);

    for (var x = 0; x < 4; x++) {
        for (var y = 0; y < 4; y++) {
            boardPos[x][y][0] = startX + (x * gameSquarePadding) + (x * gameSquareSize) + (gameSquarePadding);
            boardPos[x][y][1] = startY + (y * gameSquarePadding) + (y * gameSquareSize) + (gameSquarePadding);
            var smallSquare = new createjs.Shape();
            smallSquare.graphics.beginFill('#bbada0').drawRoundRect(
                boardPos[x][y][0], boardPos[x][y][1],
                gameSquareSize, gameSquareSize,
                gameSquareSize * .04);
            smallSquare.cache(boardPos[x][y][0], boardPos[x][y][1], gameSquareSize, gameSquareSize);
            stage.addChild(smallSquare);

            // square indicators
            if (debug) {
                var text2 = new createjs.Text(x + "," + y, "10px capture_itregular", "#000");
                text2.x = boardPos[x][y][0] - 5;
                text2.y = boardPos[x][y][1] - 5;
                stage.addChild(text2);
            }
        }
    }
}
function drawBoard() {
    for (var x = 0; x < 4; x++) {
        for (var y = 0; y < 4; y++) {
            if (gameBoardValue[x][y] !== 0) {
                createSquare(gameBoardValue[x][y], x, y);

                createjs.Tween.get(gameBoardSquares[x][y], {override: false, loop: false}).to({
                    x: boardPos[x][y][0],
                    y: boardPos[x][y][1],
                    alpha: 1,
                    scaleX: 1,
                    scaleY: 1
                }, animationSpeed, animationType);
            } else {
                if (gameBoardValue[x][y]) {
                    stage.removeChild(gameBoardValue[x][y]);
                }
            }
        }
    }
}
function newGame() {
    score = 0;
    $$('#current-score').text(score);
    stage.removeAllChildren();
    clearAll();
    setGameBoard();
    drawBoard();
    drawScore();
    addRandomBlock();
    addRandomBlock();
}
function createSquare(value, x, y) {
    gameBoardSquares[x][y] = new createjs.Container();
    var square = new createjs.Shape();
    square.graphics.beginFill(valueBackgroundColor[value]).drawRoundRect(
        0, 0,
        gameSquareSize, gameSquareSize,
        gameSquareSize * .04);
    gameBoardSquares[x][y].addChild(square);

    var textSize = gameSquareSize * .85;
    if (value > 5) {
        textSize = gameSquareSize * .65;
    }
    if (value > 9) {
        textSize = gameSquareSize * .45;
    }
    if (value > 13) {
        textSize = gameSquareSize * .39;
    }

    var text = new createjs.Text(Math.pow(2, value), textSize + "px capture_itregular", valueTextColor[value]);
    var textWidth = text.getMeasuredWidth();
    var textHeight = text.getMeasuredHeight();
    text.x = gameSquareSize / 2 - textWidth / 2;
    text.y = gameSquareSize / 2 - textHeight / 2;
    gameBoardSquares[x][y].addChild(text);

    gameBoardSquares[x][y].x = boardPos[x][y][0] + gameSquareSize/2;
    gameBoardSquares[x][y].y = boardPos[x][y][1] + gameSquareSize/2;
    gameBoardSquares[x][y].alpha = 0;
    gameBoardSquares[x][y].scaleX = 0;
    gameBoardSquares[x][y].scaleY = 0;

    stage.addChild(gameBoardSquares[x][y]);
    gameBoardValue[x][y] = value;
    localStorage.setItem("gameBoardValue", JSON.stringify(gameBoardValue));
}
function clearMemory() {
    gameBoardHistory = [];
    gameScoreHistory = [];
    localStorage.setItem("score", 0);
    localStorage.setItem("gameBoardValue", null);
    gameBoardValue = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
}
function clearAll() {
    clearMemory();
    for (var x = 0; x < 4; x++) {
        for (var y = 0; y < 4; y++) {
            if (gameBoardSquares[x][y]) stage.removeChild(gameBoardSquares[x][y]);
        }
    }
}
function randomizeBoard() {
    score = 0;
    $$('#current-score').text(score);
    stage.removeAllChildren();
    clearAll();
    for (var x = 0; x < 4; x++) {
        for (var y = 0; y < 4; y++) {
            gameBoardValue[x][y] = Math.round(Math.random() * 15) - 9 + difficulty/1;
            if (gameBoardValue[x][y] < 0) gameBoardValue[x][y] = 0;
        }
    }
    setGameBoard();
    drawBoard();
    drawScore();
}
function addRandomBlock() {
    var x, y;
    while (true) {
        x = Math.floor(Math.random() * 4);
        y = Math.floor(Math.random() * 4);
        if (gameBoardValue[x][y] === 0) {
            var value = Math.floor(Math.random() * difficulty)+1;
            gameBoardValue[x][y] = value;
            createSquare(value, x, y);
            createjs.Tween
                .get(gameBoardSquares[x][y], {override: false, loop: false})
                .to({
                    x: boardPos[x][y][0],
                    y: boardPos[x][y][1],
                    alpha: 1,
                    scaleX: 1,
                    scaleY: 1
                }, animationSpeed*2, animationType);
            return;
        }
    }
}
function consoleLogGameBoard() {
    console.log('----------P----------');
    for (var y = 0; y < 4; y++) {
        var one = (Math.pow(2, gameBoardValue[0][y]) !== 1 ? Math.pow(2, gameBoardValue[0][y]) : '-' );
        var two = (Math.pow(2, gameBoardValue[1][y]) !== 1 ? Math.pow(2, gameBoardValue[1][y]) : '-' );
        var tree = (Math.pow(2, gameBoardValue[2][y]) !== 1 ? Math.pow(2, gameBoardValue[2][y]) : '-' );
        var four = (Math.pow(2, gameBoardValue[3][y]) !== 1 ? Math.pow(2, gameBoardValue[3][y]) : '-' );
        console.log('\t' + one + '\t' + two + '\t' + tree + '\t' + four);
    }
}
function consoleLogGameBoardBlocks() {
    console.log('-----------B-----------');
    for (var y = 0; y < 4; y++) {
        var one = (gameBoardBlocked[0][y] ? 'b' : '-');
        var two = (gameBoardBlocked[1][y] ? 'b' : '-');
        var tree = (gameBoardBlocked[2][y] ? 'b' : '-');
        var four = (gameBoardBlocked[3][y] ? 'b' : '-');
        console.log('row ' + y + ': \t' + one + '\t' + two + '\t' + tree + '\t' + four);
    }
}
function consoleLogGameMoving(x, y) {
    console.log('-----------M-----------');
    for (var ry = 0; ry < 4; ry++) {
        console.log('row ' + ry + ': \t' + (x === 0 && y === ry ? 'm' : '-') + '\t' + (x === 1 && y === ry ? 'm' : '-') + '\t' + (x === 2 && y === ry ? 'm' : '-') + '\t' + (x === 3 && y === ry ? 'm' : '-'));
    }
}
function undo() {
    if (undoRemaining > 0 && gameBoardHistory.length > 0) {
        for (var x = 0; x < 4; x++) {
            for (var y = 0; y < 4; y++) {
                if (gameBoardSquares[x][y]) stage.removeChild(gameBoardSquares[x][y]);
            }
        }
        if (gameBoardHistory.length > 0) gameBoardValue = gameBoardHistory.pop();
        if (gameScoreHistory.length > 0) score = gameScoreHistory.pop();
        undoRemaining--;
        window.localStorage.setItem("undoRemaining", undoRemaining);
        drawBoard();
        drawScore();
    } else if (gameBoardHistory.length === 0) {
        myApp.alert('No History to undo!', 'Undo');
    } else if (undoRemaining === 0) {
        myApp.alert('You have no more undos! More can be achieved by getting 2048!', 'Undo');
    }
}
function saveHistory() {
    gameBoardHistory.push(copy(gameBoardValue));
    gameScoreHistory.push(score);
}
function copy(arr){
    if(arr[0] instanceof Array){
        var new_arr = new Array(arr.length);
        for(var i = arr.length; i--;)
            new_arr[i] = copy(arr[i]);
    }
    else{var new_arr = arr.slice(0);}
    return new_arr;
}
function checkBoardFull() {
    for (var x = 0; x < 4; x++) {
        for (var y = 0; y < 4; y++) {
            if (combineLeft(x,y) || combineRight(x,y) || combineUp(x,y) || combineDown(x,y)
                    || getLeft(x,y) !== 0 || getRight(x, y) !== 0 || getUp(x, y) !== 0 || getDown(x, y) !==0) return false;
        }
    }
    return true;
}
function combineMain(oldX, oldY, newX, newY){
    if ($$('#sound-on').prop("checked")) createjs.Sound.play('combine');

    createjs.Tween.get(gameBoardSquares[oldX][oldY], {override: false, loop: false}).to({
        x: boardPos[newX][newY][0],
        y: boardPos[newX][newY][1],
        alpha: 0
    }, animationSpeed, animationType).call(function(){
        stage.removeChild(this);
    });

    if (gameBoardSquares[newX][newY]) createjs.Tween.get(gameBoardSquares[newX][newY], {override: false, loop: false}).to({
        alpha: 0
    }, animationSpeed*2, animationType).call(function(){
        stage.removeChild(this);
    });

    createSquare(gameBoardValue[oldX][oldY]+1, newX, newY);

    score += Math.pow(2, gameBoardValue[oldX][oldY]+1);
    localStorage.setItem("score", score);

    createjs.Tween.get(gameBoardSquares[newX][newY], {override: false, loop: false}).to({
        x: boardPos[newX][newY][0],
        y: boardPos[newX][newY][1],
        scaleX: 1,
        scaleY: 1
    }, 0, animationType).to({
        x: boardPos[newX][newY][0] - gameSquareSize *.1,
        y: boardPos[newX][newY][1] - gameSquareSize *.1,
        alpha: 1,
        scaleX: 1.2,
        scaleY: 1.2
    }, animationSpeed, animationType).to({
        x: boardPos[newX][newY][0],
        y: boardPos[newX][newY][1],
        scaleX: 1,
        scaleY: 1
    }, animationSpeed/4, animationType).call(function(){

    });

    // gift new undo when 2048 or higher is done
    if (gameBoardValue[oldX][oldY]+1 > 10) {
        undoRemaining++;
        localStorage.setItem("undoRemaining", undoRemaining);
        drawScore();
        newUndoMessage();
    }

    gameBoardValue[oldX][oldY] = 0;
    gameBoardSquares[oldX][oldY] = null;
    gameBoardBlocked[oldX][oldY] = false;
    gameBoardBlocked[newX][newY] = true;
}
function moveMain(oldX, oldY, newX, newY){
    if ($$('#sound-on').prop("checked")) createjs.Sound.play('nocombine');
    createjs.Tween.get(gameBoardSquares[oldX][oldY], {override: false, loop: false}).to({
        x: boardPos[newX][newY][0],
        y: boardPos[newX][newY][1]
    }, animationSpeed, animationType);

    // switch values
    gameBoardValue[newX][newY] = gameBoardValue[oldX][oldY];
    gameBoardValue[oldX][oldY] = 0;

    gameBoardSquares[newX][newY] = gameBoardSquares[oldX][oldY];
    gameBoardSquares[oldX][oldY] = null;
}
function clearAllBlocked() {
    for (var x = 0; x < 4; x++) {
        for (var y = 0; y < 4; y++) {
            gameBoardBlocked[x][y] = false;
        }
    }
}
function formatNumber(num) {
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1 ")
}
/**
 * Left
 * **/
function gameLeft() {
    var move = false;
    if (!running) {
        running = true;
        for (var x = 0; x < 4; x++) {
            for (var y = 0; y < 4; y++) {
                //console.log("x: " + x + " y: " + y);
                if (gameBoardValue[x][y] !== 0) {
                    var moveX = getLeft(x, y);

                    if (combineLeft(x,y)) {
                        move = true;
                        moveX++;
                        combineMain(x, y, x-moveX, y);

                    } else if (gameBoardValue[x - moveX][y] === 0 && moveX !== 0) {
                        move = true;
                        moveMain(x, y, x-moveX, y);
                    }
                }
            }
        }
        running = false;
        if (move) addRandomBlock();
        clearAllBlocked();
    }
    return move;
}
function getLeft(x, y) {
    var moveX = 0;
    for (var num = x-1; num >= 0; num--) {
        if (gameBoardValue[num][y] !== 0) {
            return moveX;
        } else {
            moveX++;
        }
    }
    return moveX;
}
function combineLeft(x, y) {
    for (var num = x-1; num >= 0; num--) {
        if ((gameBoardValue[x][y] !== gameBoardValue[num][y] && gameBoardValue[num][y] !== 0) || gameBoardBlocked[num][y]) return false;
        else if (gameBoardValue[x][y] === gameBoardValue[num][y] && !gameBoardBlocked[num][y]) return true;
    }
    return false;
}
/**
 * Right
 * **/
function gameRight() {
    var move = false;
    if (!running) {
        running = true;
        for (var y = 3; y >= 0; y--) {
            for (var x = 3; x >= 0; x--) {
                //console.log("x: " + x + " y: " + y);
                if (gameBoardValue[x][y] !== 0) {
                    var moveX = getRight(x, y);

                    if (combineRight(x,y)) {
                        move = true;
                        moveX++;
                        combineMain(x, y, x+moveX, y);

                    } else if (gameBoardValue[x + moveX][y] === 0 && moveX !== 0) {
                        move = true;
                        moveMain(x, y, x+moveX, y);
                    }
                }
            }
        }
        running = false;
        if (move) addRandomBlock();
        clearAllBlocked();
    }
    return move;
}
function getRight(x, y) {
    var moveX = 0;
    for (var num = x+1; num < 4; num++) {
        if (gameBoardValue[num][y] !== 0) {
            return moveX;
        } else {
            moveX++;
        }
    }
    return moveX;
}
function combineRight(x, y) {
    for (var num = x+1; num < 4; num++) {
        if ((gameBoardValue[x][y] !== gameBoardValue[num][y] && gameBoardValue[num][y] !== 0) || gameBoardBlocked[num][y]) return false;
        else if (gameBoardValue[x][y] === gameBoardValue[num][y] && !gameBoardBlocked[num][y]) return true;
    }
    return false;
}
/**
 * Down
 * **/
function gameDown() {
    var move = false;
    if (!running) {
        running = true;
        for (var x = 3; x >= 0; x--) {
            for (var y = 3; y >= 0; y--) {
                //console.log("x: " + x + " y: " + y);
                if (gameBoardValue[x][y] !== 0) {
                    var moveY = getDown(x, y);

                    if (combineDown(x,y)) {
                        move = true;
                        moveY++;
                        combineMain(x, y, x, y+moveY);

                    } else if (gameBoardValue[x][y + moveY] === 0 && moveY !== 0) {
                        move = true;
                        moveMain(x, y, x, y+moveY);
                    }
                }
            }
        }
        running = false;
        if (move) addRandomBlock();
        clearAllBlocked();
    }
    return move;
}
function getDown(x, y) {
    var moveY = 0;
    for (var num = y+1; num < 4; num++) {
        if (gameBoardValue[x][num] !== 0) {
            return moveY;
        } else {
            moveY++;
        }
    }
    return moveY;
}
function combineDown(x, y) {
    for (var num = y+1; num < 4; num++) {
        if ((gameBoardValue[x][y] !== gameBoardValue[x][num] && gameBoardValue[x][num] !== 0) || gameBoardBlocked[x][num]) return false;
        else if (gameBoardValue[x][y] === gameBoardValue[x][num] && !gameBoardBlocked[x][num]) return true;
    }
    return false;
}
/**
 * UP
 * **/
function gameUp() {
    var move = false;
    if (!running) {
        running = true;
        for (var y = 0; y < 4; y++) {
            for (var x = 0; x < 4; x++) {
                //console.log("x: " + x + " y: " + y);
                if (gameBoardValue[x][y] !== 0) {
                    var moveY = getUp(x, y);

                    if (combineUp(x,y)) {
                        move = true;
                        moveY++;
                        combineMain(x, y, x, y-moveY);

                    } else if (gameBoardValue[x][y - moveY] === 0 && moveY !== 0) {
                        move = true;
                        moveMain(x, y, x, y-moveY);
                    }
                }
            }
        }
        running = false;
        if (move) addRandomBlock();
        clearAllBlocked();
    }
    return move;
}
function getUp(x, y) {
    var moveY = 0;
    for (var num = y-1; num >= 0; num--) {
        if (gameBoardValue[x][num] !== 0) {
            return moveY;
        } else {
            moveY++;
        }
    }
    return moveY;
}
function combineUp(x, y) {
    for (var num = y-1; num >= 0; num--) {
        if ((gameBoardValue[x][y] !== gameBoardValue[x][num] && gameBoardValue[x][num] !== 0) || gameBoardBlocked[x][num]) return false;
        else if (gameBoardValue[x][y] === gameBoardValue[x][num] && !gameBoardBlocked[x][num]) return true;
    }
    return false;
}