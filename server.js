const express = require('express');
const path = require('path');
const multer = require('multer');

const app = express();

app.use(express.json());

/* FRONTEND */

app.use(express.static(
  path.join(__dirname,"public")
));

/* IMAGENES */

const storage =
multer.diskStorage({

  destination:function(req,file,cb){

    cb(null,"uploads/");

  },

  filename:function(req,file,cb){

    cb(
      null,
      Date.now() +
      "-" +
      file.originalname
    );

  }

});

const upload =
multer({storage});

/* TOKEN */

function verifyToken(req,res,next){

  const token =
  req.headers.authorization;

  if(token !== "apictures123"){

    return res.status(401).json({
      error:"No autorizado"
    });

  }

  next();

}

/* DATOS */

let posts = [];

/* RUTAS */

app.get("/posts",

  verifyToken,

  (req,res)=>{

    res.json(posts);

});

app.post(

  "/posts",

  verifyToken,

  upload.single("image"),

  (req,res)=>{

    const newPost = {

      id:Date.now(),

      user:req.body.user,

      text:req.body.text,

      tags:req.body.tags,

      image:req.file
      ?
      "/uploads/" + req.file.filename
      :
      null

    };

    posts.unshift(newPost);

    res.json({
      success:true
    });

});

app.delete(

  "/posts/:id",

  verifyToken,

  (req,res)=>{

    const id =
    parseInt(req.params.id);

    posts =
    posts.filter(
      post => post.id !== id
    );

    res.json({
      success:true
    });

});

/* CARPETA UPLOADS */

app.use(
  "/uploads",
  express.static(
    path.join(__dirname,"uploads")
  )
);

/* INICIAR */

app.listen(3000,()=>{

  console.log(
    "Servidor funcionando en http://localhost:3000"
  );

});