import {Route, Routes} from 'react-router-dom'
import News from './pages/News'
import Events from './pages/Events'
import Application from './pages/Application'
import Reports from './pages/Reports'
import LoginForm from './pages/LoginForm'
import Profile from './pages/Profile'

function Content(props) {
    return (
        <>
            <div className='content-wrapper'>
                <div className='content'>
                    <Routes>
                        <Route path='/' element={<News currentUserInfo={props.currentUserInfo} />} />
                        <Route path='/events' element={<Events currentUserInfo={props.currentUserInfo}/>} />
                        <Route path='/reports' element={<Reports currentUserInfo={props.currentUserInfo}/>} />
                        {props.isLoggedIn && (
                            <Route path='/application' element={<Application currentUserInfo={props.currentUserInfo} />} />
                        )}
                        {props.isLoggedIn && (
                            <Route path="/profile" element={<Profile currentUserInfo={props.currentUserInfo} />} />
                        )}
                        <Route path='/login' element={<LoginForm setCurrentUserInfo={props.setCurrentUserInfo} setIsLoggedIn={props.setIsLoggedIn} />} />
                    </Routes>
                </div>
            </div>
        </>
    )
}

export default Content