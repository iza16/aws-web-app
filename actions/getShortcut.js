var AWS = require("aws-sdk");
var os = require("os");
var fs = require('fs');
//accessKeyId ... klucze do amazona 
AWS.config.loadFromPath('./config.json');

//zawiera funkcje pomocnicze generowania skrótów robienia z jonson obiektu ...
var helpers = require("../helpers");

//obiekt do obsługi simple DB z aws-sdk
var simpledb = new AWS.SimpleDB();

//funkcja która zostanie wykonana po wejściu na stronę 
//request dane o zapytaniu, callback funkcja zwrotna zwracająca kod html
var task =  function(request, callback){

	//$_GET['bucket'], $_GET['key'], $_GET['etag']
	var key =  request.query.key;
	
	//parametr do wybrania danych z bazy
	var params1 = {
		DomainName: 'borowieckad1', //required 
		ItemName: 'ITEM001', // required 
		AttributeNames: [
			key,
		],
	};
	simpledb.getAttributes(params1, function(err, data) {
		if (err) {
			console.log(err, err.stack); // an error occurred
		}
		else {     
			console.log(data);           // successful response
			if(data.Attributes){
				callback(null,data.Attributes[0].Value);
			}else{
				callback(null,"Still not...");
			}
			
		}
	});	

}
exports.action = task
