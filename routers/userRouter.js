const { PrismaClient } = require('@prisma/client');
const express = require('express');
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt');

const verifyToken = require('../middlewares/protected');

const userRouter = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET; // Use a secure, environment-stored secret in production
const SALT_ROUNDS = 10; // Adjust this based on security and performance needs

// User Signup
userRouter.post('/signup', async (req, res) => {
  try {
    const { name, email, password, profileImage } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create the user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        profileImage,
      },
      select:{
        id:true,
        name:true,
        email:true,
        profileImage:true
      }
    });

    // Generate JWT token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '1h',
    });
    res.cookie("token",token,{
      httpOnly : true,
      maxAge : 2000000
    })
    res.status(201).json({ message: 'User created successfully', token ,user});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// User Signin
userRouter.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email },select:{
      id:true,
      name:true,
      email:true,
      password:true,
      profileImage:true
    } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '1d',
    });
    res.cookie("token",token,{
      httpOnly : true,
      maxAge : 2000000
    })

    let actualUser = {
      id:user.id,
      name:user.name,
      email:user.email,
      profileImage:user.profileImage
    }
    res.status(200).json({ message: 'Logged in successfully', token , user: actualUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

userRouter.get('/logout',(req,res) => {
  res.clearCookie("token")
  res.status(200).json({message:"Logged out successfully"})
})
userRouter.get('/me',verifyToken, async (req,res) => {
  const {id} = req.user
  try{
    const user = await prisma.user.findUnique({
      where : {
        id
      },select : {
        id : true,
        name : true,
        email : true,
        profileImage : true
      }
    })
    res.status(200).json({user})
  }catch(error){
    console.log(error)
    res.status(500).json({error:"Internal Server Error"})
  }
})

userRouter.put('/update',verifyToken,async (req,res) => {
  const {id} = req.user
  const {name,profileImage} = req.body
  try{
    const user = await prisma.user.update({
      where : {
        id
      },
      data : {
        name,
        profileImage
      }
    })
    res.status(200).json({message:"User updated successfully"})
  }catch(error){
    console.log(error)
    res.status(500).json({error:"Internal Server Error"})
  }
})


module.exports  = userRouter;