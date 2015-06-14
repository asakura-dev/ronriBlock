enchant();
//デバッグ用
var log = function(x){
	console.log(x);
}

window.onload = function(){
	/*----------------------
	  Core Setting
	  ----------------------*/
	var core = new Core(1200, 700);
	core.fps = 60;

	/*----------------------
	  Preload Images
	  ----------------------*/
	var preload_imgs = ["toolbox.png","workspace.png","blackhole.png","input.png",
						"output.png","not3.png","and.png","or.png","value.png",
						"0.png","1.png","migi.png","migimini.png","hidari.png",
						"hidarimini.png","ue.png","sita.png","uemini.png","sitamini.png","splitter2.png"];
	for(var i = 0;i < preload_imgs.length;i++){
		core.preload("./img/"+preload_imgs[i]);
	}
	
	/*----------------------
	  Core Main
	  ----------------------*/
	core.onload = function(){
		//ゲームのステータス
		const BUILDING = 1;
		const PLAYEING = 0;
		const PLAY_SPEED = 30;
		//ブロックが持つNodeの種類
		////値ブロックを受け取る場所(inputブロックの入力部,outputブロックの出力部)
		const RECEIVER = 2;
		////値ブロックのノード
		const VALUE_NODE = 5;
		////ブロック同士を繋げる場所，コネクタ(inputブロックの出力部，outputブロックの入力部，ゲートブロックの入出力部)
		const CONNECTOR = 3;
		////RECEIVERの値ブロックから結果を処理する場所,(ゲートブロックの中央)
		const PROCESSOR = 4;

		var game_status = BUILDING;

		//workspaceのブロックのリスト(toolbox内のブロックは含まない)
		var ronriBlocks = new Array();
		
		/*-------------------------
		  画面全体:1200 x 700)
		  上部:toolbox(1200 x 100)
		  中央:workspace(1200 x 500)
		  左部:blackhole(1200 x 100)
		  -------------------------*/

		//ドラッグして複製する元となるブロックを置く場所
		var toolbox = new Sprite(1200,100);
		toolbox.x = 0;
		toolbox.y = 0;
		toolbox.image = core.assets["./img/toolbox.png"];
		core.rootScene.addChild(toolbox);

		//ブロックを組み立てたり動かす場所
		var workspace = new Sprite(1200,500);
		workspace.x = 0;
		workspace.y = 100;
		workspace.image = core.assets["./img/workspace.png"];
		core.rootScene.addChild(workspace);

		//ブロックを削除するゴミ箱的なやつ
		var blackhole = new Sprite(1200, 100);
		blackhole.x = 0;
		blackhole.y = 600;
		blackhole.image = core.assets["./img/blackhole.png"];
		core.rootScene.addChild(blackhole);


		// ブロックがプレイ可能なように適切に配置されているかチェック
		// プレイ可能:全ブロックのCONNECTORが接続済み，全ブロックのRECEIVERがVALUEブロックを受け取っている．
		// プレイ可能　 -> return 1
		// プレイ不可能 -> return 0
		var checkPlayable = function(){
			for(var i = 0; i < ronriBlocks.length; i++){
				var ronriBlock = ronriBlocks[i];
				for(var j = 0; j < ronriBlock.inputs.length; j++){
					var input = ronriBlock.inputs[j];
					if(input.type == CONNECTOR){
						if(input.connectedNode == null){
							return 0;
						}
					}else if(input.type == RECEIVER){
						if(input.receivedValueNode == null){
							return 0;
						}
					}
				}
				for(var j = 0; j < ronriBlock.outputs.length; j++){
					var output = ronriBlock.outputs[j];
					if(output.type == CONNECTOR){
						if(output.connectedNode == null){
							return 0;
						}
					}
				}
			}
			return 1;
		}

		// PLAYING <-> BUILDING を切り替えるボタン
		var play_buildBtn = new Button("動かす","light");
		play_buildBtn.moveTo(10,110);
		play_buildBtn.ontouchstart = function(){
			if(game_status == BUILDING){
				if(checkPlayable()){
				game_status = PLAYEING;
				this.text = "組み立てる";
				}else{
					alert("正しく配置されていないブロックがあります");
				}
			}else{
				game_status = BUILDING;
				this.text = "動かす";
			}
        }
		core.rootScene.addChild(play_buildBtn);
		
		var resetBtn = new Button("ブロックをすべて片付ける","light");
		resetBtn.moveTo(10,560);
		resetBtn.ontouchstart = function(){
			if(game_status == BUILDING){
				while(ronriBlocks.length > 0){
					ronriBlocks[0].removeThis();
				}
			}
		}
		core.rootScene.addChild(resetBtn);


		/*----------------------------------
		  Core Enterflame :1/fps 秒ごとに実行
		  ----------------------------------*/
		/*core.rootScene.addEventListener("enterframe",function(){
		  });*/
		var RonriBlock = Class.create(Group,{
				initialize:function(origin){
					Group.call(this);
					this.body = new RonriBlockBody(origin,this);

					//入力部(Nodeの配列)
					this.inputs = new Array();
					//出力部(Nodeの配列)
					this.outputs = new Array();
					this.proccesor = null;
					this.origin = origin;
					this.x = origin.x;
					this.y = origin.y;

					this.touchDiffX = 0;
					this.touchDiffY = 0;

					core.rootScene.addChild(this);

					this.addEventListener(enchant.Event.TOUCH_START,function(e){
							if(game_status == BUILDING){
								log("clone touch start");//デバッグ用
								this.touchDiffX = e.x - this.x;
								this.touchDiffY = e.y - this.y;
							}
						});
					this.addEventListener(enchant.Event.TOUCH_MOVE,function(e){
							if(game_status == BUILDING){
								this.x = e.x - this.touchDiffX;
								this.y = e.y - this.touchDiffY;
							}
						});
				},

				// サブクラスで定義されるイベントリスナ(TOUCH_END)で呼び出す共通動作
				// 削除された時 -> return 1
				// 正常に配置された時 -> return 0
				touchEndCommonAction:function(){
					log("clone thouch end");//デバッグ用
					
					// toolbox内でブロックが離された時
					//// 新しいブロック -> originに戻す
					//// 一度Workspaceに置かれたブロック -> 削除
					// Workspace内でブロックが離された時
					//// tookbox内に新しいブロックを生成 
					if(this.body.intersect(toolbox)){
						if(this.origin.child == this){
							this.x = this.origin.x;
							this.y = this.origin.y;
						}else{
							this.removeThis();
							return 1;
						}
					}else{
						if(this.origin.child == this){
							this.origin.createChild();
							ronriBlocks.push(this);
							log(ronriBlocks);
							log(ronriBlocks.length);
						}
					}

					// blackhole内でブロックが離された時，ブロックを削除
					if(this.body.intersect(blackhole)){
						this.removeThis();
						return 1;
					}
					return 0;
				},
				
				// name changed
				// updateHitArea() -> updateNodeStatus()
				updateNodeStatus:function(){
					log("called updateNodeStatus");
					//入力部(左)のコネクタを外す処理
					for(var ii = 0; ii < this.inputs.length;ii++){
						var input = this.inputs[ii];
						if(input.type == CONNECTOR && input.connectedNode != null){
							var output = input.connectedNode;
							if(input.getAbsoluteX() != output.getAbsoluteX()
							   || input.getAbsoluteY() != output.getAbsoluteY()){
								input.connectedNode = null;
								output.connectedNode = null;
								input.backgroundColor = "none";
								output.backgroundColor = "none";
							}
						}
					}
					//出力部(右)のコネクタを外す処理
					for(var oi = 0; oi < this.outputs.length; oi++){
						var output = this.outputs[oi];
						if(output.type == CONNECTOR && output.connectedNode != null){
							var input = output.connectedNode;
							if(output.getAbsoluteX() != input.getAbsoluteX()
							   || output.getAbsoluteY() != input.getAbsoluteY()){
								input.connectedNode = null;
								output.connectedNode = null;
								input.backgroundColor = "none";
								output.backgroundColor = "none";
							}
						}
					}
					//valueとreceiverの関係を外す
					for(var ii = 0; ii < this.inputs.length; ii++){
						var input = this.inputs[ii];
						if(input.type == RECEIVER
						   && input.receivedValueNode != null){
							var output = input.receivedValueNode;
							if(input.getAbsoluteX() != output.getAbsoluteX() - 5
							   || input.getAbsoluteY() != output.getAbsoluteY() - 5){
								input.receivedValueNode = null;
								output.receivedValueNode = null;
							}
						}
					}
					//valueとreceiverの関係を外す
					for(var oi = 0; oi < this.outputs.length; oi++){
						var output = this.outputs[oi];
						if(output.type == VALUE_NODE
						   && output.receivedValueNode != null){
							var input = output.receivedValueNode;
							if(input.getAbsoluteX() != output.getAbsoluteX() - 5
							   || input.getAbsoluteY() != output.getAbsoluteY() -5){
								input.receivedValueNode = null;
								output.receivedValueNode = null;
							}
						}
					}

					//入力部(左)のコネクタを繋げる処理
					for(var ii = 0; ii < this.inputs.length; ii++){
						var input = this.inputs[ii];
						if(input.type == CONNECTOR && input.connectedNode == null){
							for(var rbi = 0; rbi < ronriBlocks.length; rbi++){
								for(var oi = 0; oi < ronriBlocks[rbi].outputs.length; oi++){
									var output = ronriBlocks[rbi].outputs[oi];
									if(output.type == CONNECTOR && output.connectedNode == null
									   && input.connectedNode == null){
										if(input.getAbsoluteX() == output.getAbsoluteX()
										   && input.getAbsoluteY() == output.getAbsoluteY()){
											this.connectConnectorNode(input,output);
										}
									}
								}
							}
						}
						if(input.type == RECEIVER && input.receivedValueNode == null){
							for(var rbi = 0; rbi < ronriBlocks.length; rbi++){
								for(var oi = 0; oi < ronriBlocks[rbi].outputs.length; oi++){
									var output = ronriBlocks[rbi].outputs[oi];
									if(output.type == VALUE_NODE
									   && output.receivedValueNode == null
									   && input.receivedValueNode == null
									   ){
										if(input.getAbsoluteX() == output.getAbsoluteX() - 5
										   && input.getAbsoluteY() == output.getAbsoluteY() - 5){
											input.receivedValueNode = output;
											output.receivedValueNode = input;
											log("value");
										}
									}
								}
							}
						}
					}
					//出力部(右)のコネクタを繋げる処理
					for(var oi = 0; oi < this.outputs.length; oi++){
						var output = this.outputs[oi];
						if(output.type == CONNECTOR && output.connectedNode == null){
							for(var rbi = 0; rbi < ronriBlocks.length; rbi++){
								for(var ii = 0; ii < ronriBlocks[rbi].inputs.length; ii++){
									var input = ronriBlocks[rbi].inputs[ii];
									if(input.type == CONNECTOR
									   && input.connectedNode == null
									   && output.connectedNode == null){
										if(input.getAbsoluteX() == output.getAbsoluteX()
										   && input.getAbsoluteY() == output.getAbsoluteY()){
											this.connectConnectorNode(input,output);
										}
									}
								}
							}
						}
						if(output.type == VALUE_NODE){
							for(var rbi = 0; rbi < ronriBlocks.length; rbi++){
								for(var ii = 0; ii < ronriBlocks[rbi].inputs.length; ii++){
									var input = ronriBlocks[rbi].inputs[ii];
									if(input.type == RECEIVER
									   && input.receivedValueNode == null
									   && output.receivedValueNode == null
									   ){
										if(input.getAbsoluteX() == output.getAbsoluteX() - 5
										   && input.getAbsoluteY() == output.getAbsoluteY() - 5){
											input.receivedValueNode = output;
											output.receivedValueNode = input;
											log("value");
										}
									}
								}
							}
						}
					}
				},

				//コネクタを接続する
				connectConnectorNode:function(inputConnectorNode,outputConnectorNode){
					log("called connectConnectorNode");
					inputConnectorNode.connectedNode = outputConnectorNode;
					outputConnectorNode.connectedNode = inputConnectorNode;
					//inputConnectorNode.backgroundColor = "rgba(230, 205, 184,1)";
					//outputConnectorNode.backgroundColor = "rgba(230, 205, 184,1)"
					inputConnectorNode.backgroundColor = "#666";
					outputConnectorNode.backgroundColor = "#666";
				},

				// name changed
				// connectorAction -> moveToNearConnector
				//優先度
				//1:ブロックの入力部(左側)が，他のブロックの出力部(右側)に近い時，ブロックを近くに移動
				//2:ブロックの出力部(左側)が，他のブロックの入力部(左側)に近い時，ブロックを近くに移動
				//注意：一度でも移動処理があったら関数は終了
				moveToNearConnector:function(){
					log("called moveTonearConnector");
					log(ronriBlocks.length);
					// コネクタが近かったらインプット側のブロックを近づけて繋げる処理
					for(var rbi = 0;rbi < ronriBlocks.length;rbi++){
						for(var oi = 0; oi < ronriBlocks[rbi].outputs.length;oi++){
							for(var ii = 0;ii < this.inputs.length;ii++){
								var input = this.inputs[ii];
								var output = ronriBlocks[rbi].outputs[oi];
								if(input.intersect(output) 
								   && output.type == CONNECTOR
								   && input.type == CONNECTOR
								   && input.connectedNode == null
								   && output.connectedNode == null){
									this.x = ronriBlocks[rbi].x + output.x - input.x;
									this.y = ronriBlocks[rbi].y + output.y - input.y;
									return 0;
								}
							}
						}
					}
					//ToDo:input側が繋がっていなくて，output側に近いコネクタがあったら，近づける．
					for(var oi = 0; oi < this.outputs.length; oi++){
						var output = this.outputs[oi];
						if(output.type == CONNECTOR && output.connectedNode == null){
							for(var rbi = 0; rbi < ronriBlocks.length; rbi++){
								for(var ii = 0; ii < ronriBlocks[rbi].inputs.length; ii++){
									var input = ronriBlocks[rbi].inputs[ii];
									if(input.type == CONNECTOR && input.connectedNode == null){
										if(output.intersect(input)){
											this.x = ronriBlocks[rbi].x + input.x - output.x;
											this.y = ronriBlocks[rbi].y + input.y - output.y;
										}
									}
								}
							}
						}
					}
				},
				// name changed
				// valueReceiverAction -> moveToNearReceiver
				moveToNearReceiver:function(){
					for(var i = 0; i < ronriBlocks.length; i++){
						for(var j = 0; j < ronriBlocks[i].inputs.length; j++){
							var input = ronriBlocks[i].inputs[j];
							if(this.body.intersect(input)
							   && input.type == RECEIVER
							   && input.receivedValueNode == null
							   ){
								this.x = input.getAbsoluteX() + 5;
								this.y = input.getAbsoluteY() + 5;
								return 0;
							}
						}
					}
				},
				// name changed
				// setInputArea -> setInputNode
				setInputNode:function(w,h,x,y,type){
					var new_input = new RonriBlockNode(w,h,x,y,type,this);
					this.inputs.push(new_input);
				},
				// name changed
				// setOutputArea -> setOutputNode
				setOutputNode:function(w,h,x,y,type){
					var new_output = new RonriBlockNode(w,h,x,y,type,this);
					this.outputs.push(new_output);
				},
				setProcessorNode:function(w,h,x,y,type){
					var new_processor = new RonriBlockNode(w,h,x,y,type,this);
					this.processor = new_processor;
				},
				//ブロックを削除する
				removeThis:function(){
					for(var i = 0; i < ronriBlocks.length; i++){
						if(ronriBlocks[i] == this){
							log(ronriBlocks.length);
							core.rootScene.removeChild(this);
							ronriBlocks.splice(i,1);
							log("removed");
							log(ronriBlocks.length);
							return 1;							
						}
					}
					log("faild remove this Block");
				}

			});


		var RonriBlockBody = Class.create(Sprite,{
				initialize:function(origin,parentGroup){
					Sprite.call(this,origin.width,origin.height);
					this.x = 0;
					this.y = 0;
					this.image = origin.image;
					this.parentGroup = parentGroup;
					this.parentGroup.addChild(this);
				}
			});
		// name changed
		// HitArea -> RonriBlockNode
		var RonriBlockNode = Class.create(Sprite,{
				initialize:function(w,h,x,y,type,parentGroup){
					Sprite.call(this,w,h);
					this.parentGroup = parentGroup;
					this.parentGroup.addChild(this);
					this.x = x;
					this.y = y;
					this.touchDiffX = 0;
					this.touchDiffY = 0;
					this.type = type;
					this.receivedValueNode = null;
					this.connectedNode = null;
				},
				getAbsoluteX:function(){
					return (this.parentGroup.x + this.x);
				},
				getAbsoluteY:function(){
					return (this.parentGroup.y + this.y);
				}
			});
		/*----------------------------
		  Basic Block
		  - input
		  - output
		  Gate Block
		  - not
		  - or
		  - and
		  Value Block
		  - value
		  ---------------------------*/
		var InputBlock = Class.create(RonriBlock,{
				initialize:function(origin){
					RonriBlock.call(this,origin);
					this.setInputNode(40,40,0,0,RECEIVER);
					this.setOutputNode(20,20,60,10,CONNECTOR);
					this.addEventListener(enchant.Event.TOUCH_END,function(e){
							if(game_status == BUILDING){
								if(this.touchEndCommonAction() == 0){
									this.updateNodeStatus();
									this.moveToNearConnector();
								}
								this.updateNodeStatus();
							}
						});
					this.addEventListener("enterframe",function(){
							if(game_status == PLAYEING){
								if(this.inputs[0].receivedValueNode != null){
									var value = this.inputs[0].receivedValueNode.parentGroup;
									var valueNode = this.inputs[0].receivedValueNode;
									var output = this.outputs[0];
									var endX = this.outputs[0].getAbsoluteX() + this.outputs[0].width/2 - value.body.width/2;
									var endY = this.outputs[0].getAbsoluteY() + this.outputs[0].height/2 - value.body.height/2;
									this.inputs[0].receivedValueNode = null;
									valueNode.receivedValueNode = null;
									value.tl.moveTo(endX,endY,PLAY_SPEED).then(function(){
											output.connectedNode.receivedValueNode = valueNode;
										});
								}
							}
						});
				}
			});
		var OutputBlock = Class.create(RonriBlock,{
				initialize:function(origin){
					RonriBlock.call(this,origin);
					this.setInputNode(20,20,0,10,CONNECTOR);
					this.setOutputNode(40,40,40,0,RECEIVER);
					this.addEventListener(enchant.Event.TOUCH_END,function(e){
							if(game_status == BUILDING){
								if(this.touchEndCommonAction() == 0){
									this.updateNodeStatus();
									this.moveToNearConnector();
								}
								this.updateNodeStatus();
							}
						});
					this.addEventListener("enterframe",function(){
							if(game_status == PLAYEING){
								if(this.inputs[0].receivedValueNode != null){
									var value = this.inputs[0].receivedValueNode.parentGroup;
									var valueNode = this.inputs[0].receivedValueNode;
									var output = this.outputs[0];
									var endX = this.outputs[0].getAbsoluteX() + this.outputs[0].width/2 - value.body.width/2;
									var endY = this.outputs[0].getAbsoluteY() + this.outputs[0].height/2 - value.body.height/2;
									this.inputs[0].receivedValueNode = null;
									value.tl.moveTo(endX,endY,PLAY_SPEED).then(function(){
											valueNode.receivedValueNode = null;
										});
								}
							}
						});
				}
			});
		var NotBlock = Class.create(RonriBlock,{
				initialize:function(origin){
					RonriBlock.call(this,origin);
					this.setInputNode(20,20,0,20,CONNECTOR);
					this.setOutputNode(20,20,120,20,CONNECTOR);
					this.setProcessorNode(20,20,43,20,PROCESSOR);
					this.addEventListener(enchant.Event.TOUCH_END,function(e){
							if(game_status == BUILDING){
								if(this.touchEndCommonAction() == 0){
									this.updateNodeStatus();
									this.moveToNearConnector();
									
								}
								this.updateNodeStatus();
							}
						});
					this.addEventListener("enterframe",function(){
							if(game_status == PLAYEING){

								if(this.inputs[0].receivedValueNode != null){
									var value = this.inputs[0].receivedValueNode.parentGroup;
									var valueNode = this.inputs[0].receivedValueNode;
									log(valueNode);
									var processor = this.processor;
									var endX = processor.getAbsoluteX() + processor.width/2 - value.body.width/2;
									var endY = processor.getAbsoluteY() + processor.height/2 - value.body.height/2;
									this.inputs[0].receivedValueNode = null;
									value.tl
										.moveTo(endX,endY,30)
										.scaleTo(0,1, 15)
										.and()
										.moveBy(15,0,15)
										.then(function(){
											value.toggleValue();
										})
										.scaleTo(1, 1, 15)
										.and()
										.moveBy(-15,0,15)
										.then(function(){
												processor.receivedValueNode = valueNode;
											});
								}
								if(this.processor.receivedValueNode != null){
									var value = this.processor.receivedValueNode.parentGroup;
									var valueNode = this.processor.receivedValueNode;
									var output = this.outputs[0];
									var endX = output.getAbsoluteX() + output.width/2 - value.body.width/2;
									var endY = output.getAbsoluteY() + output.height/2 - value.body.height/2;
									this.processor.receivedValueNode = null;
									value.tl
										.moveTo(endX,endY,30)
										.then(function(){
											output.connectedNode.receivedValueNode = valueNode;
										});
								}

							}
						});
				}
			});
		var AndBlock = Class.create(RonriBlock,{
				initialize:function(origin){
					RonriBlock.call(this,origin);
					this.setInputNode(20,20,0,0,CONNECTOR);
					this.setInputNode(20,20,0,60,CONNECTOR);
					this.setOutputNode(20,20,120,30,CONNECTOR);
					this.setProcessorNode(20,20,60,30,PROCESSOR);
					this.addEventListener(enchant.Event.TOUCH_END,function(){
							if(game_status == BUILDING){

								if(this.touchEndCommonAction() == 0){
									this.updateNodeStatus();
									this.moveToNearConnector();
								}
								this.updateNodeStatus();
							}
						});
					this.addEventListener("enterframe",function(){
							if(game_status == PLAYEING){
								
								if(this.inputs[0].receivedValueNode != null
								   && this.inputs[1].receivedValueNode != null){
									var value1 = this.inputs[0].receivedValueNode.parentGroup;
									var value1Node = this.inputs[0].receivedValueNode;
									var value2 = this.inputs[1].receivedValueNode.parentGroup;
									var value2Node = this.inputs[1].receivedValueNode;
									var processor = this.processor;
									var endX = processor.getAbsoluteX() + processor.width/2 - value1.body.width/2;
									var endY = processor.getAbsoluteY() + processor.height/2 - value1.body.height/2;
									this.inputs[0].receivedValueNode = null;
									this.inputs[1].receivedValueNode = null;
									var result = 0;
									result = value1.value * value2.value;

									value1.tl
										.moveTo(endX,value1.y,30)
										.moveTo(endX,endY,30)
										.then(function(){
											value1.removeThis();
										});

									value2.tl
										.moveTo(endX,value2.y,30)
										.moveTo(endX,endY,30)
										.then(function(){
												value2.changeValue(result);
												processor.receivedValueNode = value2Node;
										});
								}
								if(this.processor.receivedValueNode != null){
									var value = this.processor.receivedValueNode.parentGroup;
									var valueNode = this.processor.receivedValueNode;
									var output = this.outputs[0];
									var endX = output.getAbsoluteX() + output.width/2 - value.body.width/2;
									var endY = output.getAbsoluteY() + output.height/2 - value.body.height/2;
									this.processor.receivedValueNode = null;
									value.tl
										.moveTo(endX,endY,30)
										.then(function(){
											output.connectedNode.receivedValueNode = valueNode;
										});
								}
								
							}
						});
				},
			});
		var OrBlock = Class.create(RonriBlock,{
				initialize:function(origin){
					RonriBlock.call(this,origin);
					this.setInputNode(20,20,0,0,CONNECTOR);
					this.setInputNode(20,20,0,60,CONNECTOR);
					this.setOutputNode(20,20,120,30,CONNECTOR);
					this.setProcessorNode(20,20,60,30,PROCESSOR);
					this.addEventListener(enchant.Event.TOUCH_END,function(){
							if(game_status == BUILDING){
								if(this.touchEndCommonAction() == 0){
									this.updateNodeStatus();
									this.moveToNearConnector();
								}
								this.updateNodeStatus();
								}
						});
					this.addEventListener("enterframe",function(){
							if(game_status == PLAYEING){
								
								if(this.inputs[0].receivedValueNode != null
								   && this.inputs[1].receivedValueNode != null){
									var value1 = this.inputs[0].receivedValueNode.parentGroup;
									var value1Node = this.inputs[0].receivedValueNode;
									var value2 = this.inputs[1].receivedValueNode.parentGroup;
									var value2Node = this.inputs[1].receivedValueNode;
									var processor = this.processor;
									var endX = processor.getAbsoluteX() + processor.width/2 - value1.body.width/2;
									var endY = processor.getAbsoluteY() + processor.height/2 - value1.body.height/2;
									this.inputs[0].receivedValueNode = null;
									this.inputs[1].receivedValueNode = null;
									var result = 0;
									if(value1.value == 0 && value2.value == 0){
										result = 0;
									}else{
										result = 1;
									}
									value1.tl
										.moveTo(endX,value1.y,30)
										.moveTo(endX,endY,30)
										.then(function(){
											value1.removeThis();
										});

									value2.tl
										.moveTo(endX,value2.y,30)
										.moveTo(endX,endY,30)
										.then(function(){
												value2.changeValue(result);
												processor.receivedValueNode = value2Node;
										});
								}
								if(this.processor.receivedValueNode != null){
									var value = this.processor.receivedValueNode.parentGroup;
									var valueNode = this.processor.receivedValueNode;
									var output = this.outputs[0];
									var endX = output.getAbsoluteX() + output.width/2 - value.body.width/2;
									var endY = output.getAbsoluteY() + output.height/2 - value.body.height/2;
									this.processor.receivedValueNode = null;
									value.tl
										.moveTo(endX,endY,30)
										.then(function(){
											output.connectedNode.receivedValueNode = valueNode;
										});
								}
								
							}
						});
				},
			});
		var ValueBlock = Class.create(RonriBlock,{
				initialize:function(origin){
					RonriBlock.call(this,origin);
					if(origin.image._css == "url(./img/1.png)"){
						this.value = 1;
					}else{
						this.value = 0;
					}
					this.setOutputNode(30,30,0,0,VALUE_NODE);
					this.addEventListener(enchant.Event.TOUCH_END,function(e){
							if(game_status == BUILDING){
								if(this.touchEndCommonAction() == 0){
									this.updateNodeStatus();
									this.moveToNearReceiver();
								}
								this.updateNodeStatus();
							}
						});
				},
				changeValue:function(v){
					if(v == 1){
						this.value = 1;
						this.body.image = core.assets["./img/1.png"];
					}else{
						this.value = 0;
						this.body.image = core.assets["./img/0.png"];
					}
				},
				toggleValue:function(){
					if(this.value == 1){
						this.value = 0;
						this.body.image = core.assets["./img/0.png"];
					}else{
						this.value = 1;
						this.body.image = core.assets["./img/1.png"];
					}
				}
			});
		var RightLineBlock = Class.create(RonriBlock,{
				initialize:function(origin){
					RonriBlock.call(this,origin);
					this.setInputNode(20,20,0,0,CONNECTOR);
					this.setOutputNode(20,20,60,0,CONNECTOR);
					this.addEventListener(enchant.Event.TOUCH_END,function(){
							if(game_status == BUILDING){
								if(this.touchEndCommonAction() == 0){
									this.updateNodeStatus();
									this.moveToNearConnector();
								}
								this.updateNodeStatus();
							}
						});
					this.addEventListener("enterframe",function(){
							if(game_status == PLAYEING){
								if(this.inputs[0].receivedValueNode != null){
									var value = this.inputs[0].receivedValueNode.parentGroup;
									var valueNode = this.inputs[0].receivedValueNode;
									var output = this.outputs[0];
									var endX = this.outputs[0].getAbsoluteX() + this.outputs[0].width/2 - value.body.width/2;
									var endY = this.outputs[0].getAbsoluteY() + this.outputs[0].height/2 - value.body.height/2;
									this.inputs[0].receivedValueNode = null;
									valueNode.receivedValueNode = null;
									value.tl.moveTo(endX,endY,PLAY_SPEED).then(function(){
											output.connectedNode.receivedValueNode = valueNode;
										});
								}
							}
						});
					/*this.outputs[0].addEventListener(enchant.Event.TOUCH_START,function(e){
							if(game_status == BUILDING){
								log("clone touch start");//デバッグ用
								this.touchDiffX = e.x - this.getAbsoluteX();
								this.touchDiffY = e.y - this.getAbsoluteY();
							}
						});
					this.outputs[0].addEventListener(enchant.Event.TOUCH_MOVE,function(e){
							if(game_status == BUILDING){
								this.parentGroup.body.width = 500;
								log(this.parentGroup.body.width);
								this.x = this.x + e.x - this.touchDiffX
							}
							});*/
				}
			});
		var RightMiniLineBlock = Class.create(RonriBlock,{
				initialize:function(origin){
					RonriBlock.call(this,origin);
					this.setInputNode(20,20,0,0,CONNECTOR);
					this.setOutputNode(20,20,30,0,CONNECTOR);
					this.addEventListener(enchant.Event.TOUCH_END,function(){
							if(game_status == BUILDING){
								if(this.touchEndCommonAction() == 0){
									this.updateNodeStatus();
									this.moveToNearConnector();
								}
								this.updateNodeStatus();
							}
						});
					this.addEventListener("enterframe",function(){
							if(game_status == PLAYEING){
								if(this.inputs[0].receivedValueNode != null){
									var value = this.inputs[0].receivedValueNode.parentGroup;
									var valueNode = this.inputs[0].receivedValueNode;
									var output = this.outputs[0];
									var endX = this.outputs[0].getAbsoluteX() + this.outputs[0].width/2 - value.body.width/2;
									var endY = this.outputs[0].getAbsoluteY() + this.outputs[0].height/2 - value.body.height/2;
									this.inputs[0].receivedValueNode = null;
									valueNode.receivedValueNode = null;
									value.tl.moveTo(endX,endY,PLAY_SPEED).then(function(){
											output.connectedNode.receivedValueNode = valueNode;
										});
								}
							}
						});
					/*this.outputs[0].addEventListener(enchant.Event.TOUCH_START,function(e){
							if(game_status == BUILDING){
								log("clone touch start");//デバッグ用
								this.touchDiffX = e.x - this.getAbsoluteX();
								this.touchDiffY = e.y - this.getAbsoluteY();
							}
						});
					this.outputs[0].addEventListener(enchant.Event.TOUCH_MOVE,function(e){
							if(game_status == BUILDING){
								this.parentGroup.body.width = 500;
								log(this.parentGroup.body.width);
								this.x = this.x + e.x - this.touchDiffX
							}
							});*/
				}
			});
		var LeftLineBlock = Class.create(RonriBlock,{
				initialize:function(origin){
					RonriBlock.call(this,origin);
					this.setInputNode(20,20,60,0,CONNECTOR);
					this.setOutputNode(20,20,0,0,CONNECTOR);
					this.addEventListener(enchant.Event.TOUCH_END,function(){
							if(game_status == BUILDING){
								if(this.touchEndCommonAction() == 0){
									this.updateNodeStatus();
									this.moveToNearConnector();
								}
								this.updateNodeStatus();
							}
						});
					this.addEventListener("enterframe",function(){
							if(game_status == PLAYEING){
								if(this.inputs[0].receivedValueNode != null){
									var value = this.inputs[0].receivedValueNode.parentGroup;
									var valueNode = this.inputs[0].receivedValueNode;
									var output = this.outputs[0];
									var endX = this.outputs[0].getAbsoluteX() + this.outputs[0].width/2 - value.body.width/2;
									var endY = this.outputs[0].getAbsoluteY() + this.outputs[0].height/2 - value.body.height/2;
									this.inputs[0].receivedValueNode = null;
									valueNode.receivedValueNode = null;
									value.tl.moveTo(endX,endY,PLAY_SPEED).then(function(){
											output.connectedNode.receivedValueNode = valueNode;
										});
								}
							}
						});
				}
			});
		var LeftMiniLineBlock = Class.create(RonriBlock,{
				initialize:function(origin){
					RonriBlock.call(this,origin);
					this.setInputNode(20,20,30,0,CONNECTOR);
					this.setOutputNode(20,20,0,0,CONNECTOR);
					this.addEventListener(enchant.Event.TOUCH_END,function(){
							if(game_status == BUILDING){
								if(this.touchEndCommonAction() == 0){
									this.updateNodeStatus();
									this.moveToNearConnector();
								}
								this.updateNodeStatus();
							}
						});
					this.addEventListener("enterframe",function(){
							if(game_status == PLAYEING){
								if(this.inputs[0].receivedValueNode != null){
									var value = this.inputs[0].receivedValueNode.parentGroup;
									var valueNode = this.inputs[0].receivedValueNode;
									var output = this.outputs[0];
									var endX = this.outputs[0].getAbsoluteX() + this.outputs[0].width/2 - value.body.width/2;
									var endY = this.outputs[0].getAbsoluteY() + this.outputs[0].height/2 - value.body.height/2;
									this.inputs[0].receivedValueNode = null;
									valueNode.receivedValueNode = null;
									value.tl.moveTo(endX,endY,PLAY_SPEED).then(function(){
											output.connectedNode.receivedValueNode = valueNode;
										});
								}
							}
						});
				}
			});
		var UpLineBlock = Class.create(RonriBlock,{
				initialize:function(origin){
					RonriBlock.call(this,origin);
					this.setInputNode(20,20,0,60,CONNECTOR);
					this.setOutputNode(20,20,0,0,CONNECTOR);
					this.addEventListener(enchant.Event.TOUCH_END,function(){
							if(game_status == BUILDING){
								if(this.touchEndCommonAction() == 0){
									this.updateNodeStatus();
									this.moveToNearConnector();
								}
								this.updateNodeStatus();
							}
						});
					this.addEventListener("enterframe",function(){
							if(game_status == PLAYEING){
								if(this.inputs[0].receivedValueNode != null){
									var value = this.inputs[0].receivedValueNode.parentGroup;
									var valueNode = this.inputs[0].receivedValueNode;
									var output = this.outputs[0];
									var endX = this.outputs[0].getAbsoluteX() + this.outputs[0].width/2 - value.body.width/2;
									var endY = this.outputs[0].getAbsoluteY() + this.outputs[0].height/2 - value.body.height/2;
									this.inputs[0].receivedValueNode = null;
									valueNode.receivedValueNode = null;
									value.tl.moveTo(endX,endY,PLAY_SPEED).then(function(){
											output.connectedNode.receivedValueNode = valueNode;
										});
								}
							}
						});
				}
			});
		var UpMiniLineBlock = Class.create(RonriBlock,{
				initialize:function(origin){
					RonriBlock.call(this,origin);
					this.setInputNode(20,20,0,30,CONNECTOR);
					this.setOutputNode(20,20,0,0,CONNECTOR);
					this.addEventListener(enchant.Event.TOUCH_END,function(){
							if(game_status == BUILDING){
								if(this.touchEndCommonAction() == 0){
									this.updateNodeStatus();
									this.moveToNearConnector();
								}
								this.updateNodeStatus();
							}
						});
					this.addEventListener("enterframe",function(){
							if(game_status == PLAYEING){
								if(this.inputs[0].receivedValueNode != null){
									var value = this.inputs[0].receivedValueNode.parentGroup;
									var valueNode = this.inputs[0].receivedValueNode;
									var output = this.outputs[0];
									var endX = this.outputs[0].getAbsoluteX() + this.outputs[0].width/2 - value.body.width/2;
									var endY = this.outputs[0].getAbsoluteY() + this.outputs[0].height/2 - value.body.height/2;
									this.inputs[0].receivedValueNode = null;
									valueNode.receivedValueNode = null;
									value.tl.moveTo(endX,endY,PLAY_SPEED).then(function(){
											output.connectedNode.receivedValueNode = valueNode;
										});
								}
							}
						});
				}
			});
		var DownLineBlock = Class.create(RonriBlock,{
				initialize:function(origin){
					RonriBlock.call(this,origin);
					this.setInputNode(20,20,0,0,CONNECTOR);
					this.setOutputNode(20,20,0,60,CONNECTOR);
					this.addEventListener(enchant.Event.TOUCH_END,function(){
							if(game_status == BUILDING){
								if(this.touchEndCommonAction() == 0){
									this.updateNodeStatus();
									this.moveToNearConnector();
								}
								this.updateNodeStatus();
							}
						});
					this.addEventListener("enterframe",function(){
							if(game_status == PLAYEING){
								if(this.inputs[0].receivedValueNode != null){
									var value = this.inputs[0].receivedValueNode.parentGroup;
									var valueNode = this.inputs[0].receivedValueNode;
									var output = this.outputs[0];
									var endX = this.outputs[0].getAbsoluteX() + this.outputs[0].width/2 - value.body.width/2;
									var endY = this.outputs[0].getAbsoluteY() + this.outputs[0].height/2 - value.body.height/2;
									this.inputs[0].receivedValueNode = null;
									valueNode.receivedValueNode = null;
									value.tl.moveTo(endX,endY,PLAY_SPEED).then(function(){
											output.connectedNode.receivedValueNode = valueNode;
										});
								}
							}
						});
				}
			});
		var DownMiniLineBlock = Class.create(RonriBlock,{
				initialize:function(origin){
					RonriBlock.call(this,origin);
					this.setInputNode(20,20,0,0,CONNECTOR);
					this.setOutputNode(20,20,0,30,CONNECTOR);
					this.addEventListener(enchant.Event.TOUCH_END,function(){
							if(game_status == BUILDING){
								if(this.touchEndCommonAction() == 0){
									this.updateNodeStatus();
									this.moveToNearConnector();
								}
								this.updateNodeStatus();
							}
						});
					this.addEventListener("enterframe",function(){
							if(game_status == PLAYEING){
								if(this.inputs[0].receivedValueNode != null){
									var value = this.inputs[0].receivedValueNode.parentGroup;
									var valueNode = this.inputs[0].receivedValueNode;
									var output = this.outputs[0];
									var endX = this.outputs[0].getAbsoluteX() + this.outputs[0].width/2 - value.body.width/2;
									var endY = this.outputs[0].getAbsoluteY() + this.outputs[0].height/2 - value.body.height/2;
									this.inputs[0].receivedValueNode = null;
									valueNode.receivedValueNode = null;
									value.tl.moveTo(endX,endY,PLAY_SPEED).then(function(){
											output.connectedNode.receivedValueNode = valueNode;
										});
								}
							}
						});
				}
			});
		var SplitterBlock =  Class.create(RonriBlock,{
				initialize:function(origin){
					RonriBlock.call(this,origin);
					this.setInputNode(20,20,0,30,CONNECTOR);
					this.setOutputNode(20,20,60,0,CONNECTOR);
					this.setOutputNode(20,20,60,60,CONNECTOR);
					this.setProcessorNode(20,20,60,30,CONNECTOR);
					this.addEventListener(enchant.Event.TOUCH_END,function(){
							if(game_status == BUILDING){
								if(this.touchEndCommonAction() == 0){
									this.updateNodeStatus();
									this.moveToNearConnector();
								}
								this.updateNodeStatus();
							}
						});
					this.addEventListener("enterframe",function(){
							if(game_status == PLAYEING){
								if(this.inputs[0].receivedValueNode != null){
									var value = this.inputs[0].receivedValueNode.parentGroup;
									var valueNode = this.inputs[0].receivedValueNode;
									var processor = this.processor;
									var endX = processor.getAbsoluteX() + processor.width/2 - value.body.width/2;
									var endY = processor.getAbsoluteY() + processor.height/2 - value.body.height/2;
									this.inputs[0].receivedValueNode = null;
									valueNode.receivedValueNode = null;
									value.tl.moveTo(endX,endY,PLAY_SPEED).then(function(){
											processor.receivedValueNode = valueNode;
										});
								}
								if(this.processor.receivedValueNode != null){
									//糞
									var value1 = this.processor.receivedValueNode.parentGroup;
									var value1Node = this.processor.receivedValueNode;
									this.processor.receivedValueNode = null;
									var value2;
									if(value1.value == 1){
										value2 = oneBlockOrigin.child;
									}else{
										value2 = zeroBlockOrigin.child;
									}
									var value2Node = value2.outputs[0];
									var output1 = this.outputs[0];
									var output2 = this.outputs[1];
									value2.x = value1.x;
									value2.y = value1.y;
									value2.touchEndCommonAction();
									var endX1 = this.outputs[0].getAbsoluteX() + this.outputs[0].width/2 - value1.body.width/2;
									var endY1 = this.outputs[0].getAbsoluteY() + this.outputs[0].height/2 - value1.body.height/2;
									var endX2 = this.outputs[1].getAbsoluteX() + this.outputs[1].width/2 - value2.body.width/2;
									var endY2 = this.outputs[1].getAbsoluteY() + this.outputs[1].height/2 - value2.body.height/2;
									value1.tl
										.moveTo(endX1,endY1,30)
										.then(function(){
												output1.connectedNode.receivedValueNode = value1Node;
											});
									value2.tl
										.moveTo(endX2,endY2,30)
										.then(function(){
												output2.connectedNode.receivedValueNode = value2Node;
											});
								}
							}
						});
				}
			});
		//ツールボックスに表示する用のブロック
		var BlockOrigin = Class.create(Sprite,{
				initialize:function(w,h,x,y,img,childtype){
					Sprite.call(this,w,h);
					this.x = x;
					this.y = y;
					this.image = core.assets["./img/"+img];
					this.originX = 0;
					this.originY = 0;
					this.child;
					this.childType = childtype;
					core.rootScene.addChild(this);
					this.createChild();
				},
				createChild:function(){
					this.child = eval("new "+this.childType+"(this);");
				}
			});
		var inputBlockOrigin = new BlockOrigin(80,40,20,5,"input.png","InputBlock");
		var outputBlockOrigin = new BlockOrigin(80,40,20,55,"output.png","OutputBlock");
		var oneBlockOrigin = new BlockOrigin(30,30,120,10,"1.png","ValueBlock");
		var zeroBlockOrigin = new BlockOrigin(30,30,120,60,"0.png","ValueBlock");
		var rightLineBlockOrigin = new BlockOrigin(80,20,180,15,"migi.png","RightLineBlock");
		var leftLineBlockOrigin = new BlockOrigin(80,20,180,65,"hidari.png","LeftLineBlock");
		var upLineBlockOrigin = new BlockOrigin(20,80,280,10,"ue.png","UpLineBlock");
		var downLineBlock = new BlockOrigin(20,80,310,10,"sita.png","DownLineBlock");
		var rightMiniLineBlockOrigin = new BlockOrigin(50,20,350,15,"migimini.png","RightMiniLineBlock");
		var leftMiniLineBlockOrigin = new BlockOrigin(50,20,350,65,"hidarimini.png","LeftMiniLineBlock");
		var upMinLineBlockOrigin = new BlockOrigin(20,50,420,25,"uemini.png","UpMiniLineBlock");
		var downMiniLineBlock = new BlockOrigin(20,50,450,25,"sitamini.png","DownMiniLineBlock");
		var splitterBlock = new BlockOrigin(80,80,490,10,"splitter2.png","SplitterBlock");
		var notBlockOrigin = new BlockOrigin(140,60,590,20,"not3.png","NotBlock");
		var andBlockOrigin = new BlockOrigin(140,80,740,10,"and.png","AndBlock");
		var orBlockOrigin = new BlockOrigin(140,80,880,10,"or.png","OrBlock");

	}
	core.start();
};