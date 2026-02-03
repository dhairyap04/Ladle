// Mongo Imports
const mongoUsers = require("../models/Users");
const { generateAccessToken, generateRefreshToken } = require("./authHelper.js")

const registerUser = async (req, res) => {
  var userInfo = req.body;
  if (!userInfo || !userInfo.name || !userInfo.email || !userInfo.password || !userInfo.isFoodbank) {
    return res.status(400).send("Input body empty or all fields not entered");
  }
  if (userInfo.name.length == 0 || userInfo.email.length == 0 || userInfo.password.length == 0) {
    return res.status(400).send("Required fields not entered");
  }

  var newUser = new mongoUsers(userInfo);

  await newUser.save(function (err, user) {
    if (err) {
      res.status(400).send("Mongo Create User Failed");
    } else {
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      res.cookie("accessToken", accessToken, {
          maxAge: 900000, // 15 minutes
          httpOnly: true
      })

      res.cookie("refreshToken", refreshToken, {
          maxAge: 1.577e7, // 6 months
          httpOnly: true
      })
      
      res.status(200).send("Mongo User successfully created");
    }
  });
}

const updateUser = async (req, res) => {
  var userInfo = req.body;
  userInfo.email = req.user.email;

  console.log(userInfo);
  if (!userInfo) {
    console.log("Error: Empty update user request");
    return res.status(400).send("Empty update user request");
  }

  await mongoUsers.updateOne({ email: userInfo.email },
    userInfo,
  ).catch((err) => {
    console.log("Error on user update: ", err);
    return res.status(400).send("Error on user update");
  });
  console.log("User successfully updated!");
  return res.status(200).send("User successfully updated");
}

const getUserInfo_handler = async (req, res) => {
  try {
    const { email } = req.user;
    await mongoUsers.find({ email: email })
      .then(response => {
        return res.status(200).json(response);
      })
  } catch (error) {
    res.status(500).json({err: error.message});
  }
}


const loginUser_handler = async (req, res) => {
  try { 
    // --- Destructure out info
    const {email, password} = req.body;

    // Check Info
    if (!email || !password) {
        return res.status(400).json({msg: "Not all fields are valid!"});
    }

    // -- Check Password
    const user = await mongoUsers.findOne({ email: email });

    if (!user) return res.status(400).json({msg: "No account with that email found!"})
    if (user.password != password) return res.status(401).json({msg: "Invalid credentials!"});
    
    // -- Send Credentials
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie("accessToken", accessToken, {
        maxAge: 900000, // 15 minutes
        httpOnly: true
    })

    res.cookie("refreshToken", refreshToken, {
        maxAge: 1.577e7, // 6 months
        httpOnly: true
    })

    res.status(200).json({
        user: {
            name: user.name,
            email: user.email,
            isFoodbank: user.isFoodbank
        }
    })

  } catch (error) {
      res.status(500).json({err: error.message});
  }
}

const logoutUser_handler = async (req, res) => {
  const user = req.user;
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  res.status(200).json(user);
}

const isAuthUser_handler = (req, res) => {
  res.status(200).send(req.user);
}

module.exports = {
  registerUser,
  updateUser,
  loginUser_handler,
  logoutUser_handler,
  isAuthUser_handler,
  getUserInfo_handler
};
